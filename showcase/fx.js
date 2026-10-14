// showcase/fx.js — texture and finishing passes for MATTER, all pure functions of their inputs.
// Each pass reads the main canvas pixels (or draws over them) using seeded noise only.

/** Deterministic hash noise in [0,1) for integer lattice coordinates and a seed. */
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 4×4 Bayer matrix thresholds (0..1) used by the ordered dither. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * 1-bit ordered dither over a rect of the canvas. `cell` is the pixel size of one dither cell
 * (1 = per pixel). `ink` and `paper` are [r,g,b]. Reads and writes the canvas in place.
 */
function ditherPass(ctx, x, y, w, h, cell = 2, ink = [8, 8, 8], paper = [244, 243, 239]) {
  const img = ctx.getImageData(x, y, w, h), d = img.data;
  for (let j = 0; j < h; j++) {
    const by = Math.floor(j / cell) & 3;
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      const lum = (0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) / 255;
      const th = BAYER4[(by << 2) | (Math.floor(i / cell) & 3)];
      const c = lum < th ? ink : paper;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
    }
  }
  ctx.putImageData(img, x, y);
}

/** Film grain: additive seeded noise of `amount` (0..1) over the full canvas, varying per frame. */
function grainPass(ctx, w, h, amount, frame, block = 2) {
  if (amount <= 0) return;
  const img = ctx.getImageData(0, 0, w, h), d = img.data, a = amount * 255;
  for (let j = 0; j < h; j += block) for (let i = 0; i < w; i += block) {
    const n = (hash(i, j, frame * 7 + 1) - 0.5) * a;
    for (let jj = 0; jj < block && j + jj < h; jj++) for (let ii = 0; ii < block && i + ii < w; ii++) {
      const k = ((j + jj) * w + i + ii) * 4;
      d[k] += n; d[k + 1] += n; d[k + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Chromatic aberration: shift the red and blue channels apart by `px` horizontally. */
function aberrationPass(ctx, w, h, px) {
  if (px < 0.5) return;
  const src = ctx.getImageData(0, 0, w, h), s = src.data;
  const out = ctx.createImageData(w, h), o = out.data;
  const sh = Math.round(px);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4;
    const kr = (j * w + Math.min(w - 1, i + sh)) * 4, kb = (j * w + Math.max(0, i - sh)) * 4;
    o[k] = s[kr]; o[k + 1] = s[k + 1]; o[k + 2] = s[kb + 2]; o[k + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

/** CRT scanlines: darken every other line by `amount`, plus a soft vignette. */
function scanlinePass(ctx, w, h, amount = 0.25, period = 3) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${amount})`;
  for (let y = 0; y < h; y += period) ctx.fillRect(0, y, w, 1);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.9);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Remap the canvas to a single hue (Tinariwen): luminance drives a two-colour ramp from
 * `dark` to `light` ([r,g,b]). Used for the one-hue-per-shot stills montage.
 */
function duotonePass(ctx, w, h, dark, light) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let k = 0; k < d.length; k += 4) {
    const l = (0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) / 255;
    d[k] = dark[0] + (light[0] - dark[0]) * l;
    d[k + 1] = dark[1] + (light[1] - dark[1]) * l;
    d[k + 2] = dark[2] + (light[2] - dark[2]) * l;
  }
  ctx.putImageData(img, 0, 0);
}

/** Paper texture: multiplicative low-frequency seeded blotches plus fine tooth. */
function paperPass(ctx, w, h, amount = 0.12, seed = 3) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) {
    const lo = hash(i >> 5, j >> 5, seed), hi = hash(i >> 1, j >> 1, seed + 1);
    const m = 1 - amount * (0.6 * lo + 0.4 * hi);
    for (let jj = 0; jj < 2; jj++) for (let ii = 0; ii < 2; ii++) {
      const k = ((j + jj) * w + i + ii) * 4;
      d[k] *= m; d[k + 1] *= m; d[k + 2] *= m;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Radial speed lines (manga / Monsters We Make) from (cx, cy); `n` lines, seeded lengths. */
function speedLines(ctx, cx, cy, n, seed, color = '#0A0A0A', inner = 180, outer = 1400, width = 3) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i, 0, seed) * 0.08;
    const r0 = inner + hash(i, 1, seed) * 140, r1 = outer * (0.6 + 0.4 * hash(i, 2, seed));
    ctx.lineWidth = width * (0.4 + hash(i, 3, seed));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Thermal palette: luminance → FLIR-style ramp (black, blue, magenta, yellow, white). */
const THERMAL = [[0, 0, 0], [20, 16, 120], [150, 20, 150], [240, 90, 60], [255, 220, 40], [255, 255, 255]];
function thermalPass(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let k = 0; k < d.length; k += 4) {
    const l = (0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) / 255;
    const p = l * (THERMAL.length - 1), i = Math.min(THERMAL.length - 2, Math.floor(p)), f = p - i;
    const a = THERMAL[i], b = THERMAL[i + 1];
    d[k] = a[0] + (b[0] - a[0]) * f; d[k + 1] = a[1] + (b[1] - a[1]) * f; d[k + 2] = a[2] + (b[2] - a[2]) * f;
  }
  ctx.putImageData(img, 0, 0);
}
