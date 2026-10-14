// Shared timing, springs, palette and drawing helpers for the 60s reel.
// Everything here is a pure function of its inputs: the film is window.seek(t).

const QS = new URLSearchParams(location.search);
const V = QS.get('v') === '1';                 // vertical 1080x1920 cut
const W = V ? 1080 : 1920, H = V ? 1920 : 1080;
const CX = W / 2, CY = H / 2;
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
let ctx = canvas.getContext('2d');

// Swap the global drawing context (used to render thumbnails off-screen).
function withCtx(c, fn) { const prev = ctx; ctx = c; try { fn(); } finally { ctx = prev; } }

// ---- Studio lockup copy (edit here) ----
const STUDIO = {
  name: 'STUDIO NAME',
  tagline: 'Global brands, in motion.',
  web: 'studioname.com',
  contact: 'hello@studioname.com',
};

// ---- Palettes and type (docs/brands.md) ----
const C = {
  black: '#0A0A0A', white: '#F4F3EF', accent: '#FF4D2E',
  hNavy: '#0B1F3A', hTeal: '#2BB3A3', hSand: '#EFE6D8', hCoral: '#F07A5F', hInk: '#061426',
  vBg: '#0B0D12', vGraph: '#0F1218', vPanel: '#181C25', vLine: '#262B37', vViolet: '#7C5CFF', vMint: '#3DDC97', vText: '#E8EAF0', vDim: '#8A90A0',
  mInk: '#062A3A', mAmber: '#FFB020', mFoam: '#A8DADC', mPaper: '#F4F1EA',
  aPearl: '#F3F1EE', aGrey: '#8A8580', aGraph: '#2A2826', aLilac: '#B9A7FF',
};
const F = {
  studio: '"Inter Display", Inter, sans-serif',
  hal: 'Fraunces, serif',
  vec: '"Space Grotesk", sans-serif',
  mer: '"Barlow Condensed", sans-serif',
  aura: 'Manrope, sans-serif',
  mono: '"DejaVu Sans Mono", monospace',
};

// ---- Beat grid: 110 BPM, beat n at (1 + 6n) / 11 s, so 5/17/29/41/53s are beats ----
const BEAT = 6 / 11;
const SEC = { open: 0, hal: 5, vec: 17, mer: 29, aura: 41, close: 53, end: 60 };
const at = (sec, b) => SEC[sec] + b * BEAT;

// ---- Springs (closed form, from lib/motion.js) ----
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function spring(t, k = 170, d = 26) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
function track(t, keys, k = 170, d = 26) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], k, d);
  return v;
}
// type: critically damped. ui: ~5% overshoot then settle. heavy: soft, big objects and camera.
const typeS = (t, k = 200) => spring(t, k, 2 * Math.sqrt(k));
const uiS = (t, k = 260) => spring(t, k, 0.68 * 2 * Math.sqrt(k));
const heavyS = (t, k = 40) => spring(t, k, 0.92 * 2 * Math.sqrt(k));
const typeTrack = (t, keys, k = 200) => track(t, keys, k, 2 * Math.sqrt(k));
const uiTrack = (t, keys, k = 260) => track(t, keys, k, 0.68 * 2 * Math.sqrt(k));
const heavyTrack = (t, keys, k = 40) => track(t, keys, k, 0.92 * 2 * Math.sqrt(k));

// ---- Maths and colour ----
const lerp = (a, b, p) => a + (b - a) * p;
const rgbOf = (c) => c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number);
function mix(a, b, p) {
  const pa = rgbOf(a), pb = rgbOf(b), q = clamp(p);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * q)).join(',')})`;
}
function rgba(hex, a) { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; }

// ---- Drawing ----
function bg(col) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
function rr(x, y, w, h, r) {
  w = Math.max(0, w); h = Math.max(0, h);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}
function font(weight, size, fam) { ctx.font = `${weight} ${size}px ${fam}`; }
// Text that rises into place from behind a mask line. p: 0 hidden -> 1 set.
function riseText(s, x, y, size, p, opts = {}) {
  if (p <= 0.001) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(-W, y - size * 1.05, 3 * W, size * 1.35); ctx.clip();
  ctx.fillStyle = opts.color || '#fff';
  ctx.textAlign = opts.align || 'left';
  ctx.fillText(s, x, y + (1 - p) * size * 1.3);
  ctx.restore();
}
// Per-letter rise, letters staggered by `step` seconds from t0.
function riseLetters(s, x, y, size, t, t0, step, color, k = 220) {
  ctx.save();
  ctx.beginPath(); ctx.rect(-W, y - size * 1.05, 3 * W, size * 1.35); ctx.clip();
  ctx.fillStyle = color; ctx.textAlign = 'left';
  let cx = x;
  [...s].forEach((ch, i) => {
    const p = typeS(t - t0 - i * step, k);
    if (p > 0.001) ctx.fillText(ch, cx, y + (1 - p) * size * 1.3);
    cx += ctx.measureText(ch).width;
  });
  ctx.restore();
}
// Fit a font size so `s` is at most maxW wide.
function fitSize(s, weight, fam, maxSize, maxW) {
  font(weight, 100, fam);
  return Math.min(maxSize, (100 * maxW) / ctx.measureText(s).width);
}
// Draw a polyline / bezier / arc progressively: p in [0,1] of total length.
function strokePartial(pts, p) {
  if (p <= 0 || pts.length < 2) return;
  let total = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  let left = total * clamp(p);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const f = Math.min(1, left / (seg[i - 1] || 1));
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
    left -= seg[i - 1];
  }
  ctx.stroke();
}
function arcPts(cx, cy, r, a0, a1, n = 48) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
function quadPts(a, c, b, n = 64) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, u = 1 - s;
    out.push([u * u * a[0] + 2 * u * s * c[0] + s * s * b[0], u * u * a[1] + 2 * u * s * c[1] + s * s * b[1]]);
  }
  return out;
}
// Odometer number: fmt uses '#' for digit places (e.g. '##,###', '##.#%'). value is an integer
// in the smallest place; digits roll continuously between values.
function odometer(fmt, value, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.textAlign = 'left';
  ctx.beginPath(); ctx.rect(x - 10, y - size * 0.8, 4000, size * 0.86); ctx.clip();
  const chars = [...fmt];
  let place = chars.filter((c) => c === '#').length - 1, cx = x, shown = false;
  const dot = fmt.indexOf('.'), unitPlace = dot < 0 ? 0 : [...fmt.slice(dot)].filter((c) => c === '#').length;
  const dw = ctx.measureText('0').width;
  for (const ch of chars) {
    if (ch !== '#') { if (shown || ch === '%') ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width; continue; }
    const cont = value / Math.pow(10, place);
    const lead = !shown && cont < 1 && place > unitPlace;
    if (!lead) shown = true;
    const d = Math.floor(cont) % 10, f = cont - Math.floor(cont);
    const roll = place === 0 ? f : (f > 0.85 ? (f - 0.85) / 0.15 : 0);
    if (!lead) {
      ctx.fillText(String(d), cx, y - roll * size);
      ctx.fillText(String((d + 1) % 10), cx, y + (1 - roll) * size);
    }
    cx += dw; place--;
  }
  ctx.restore();
}
