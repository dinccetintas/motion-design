// showcase/scenes_b.js — HEAT, PAINT and DESK (24–48 s). Each draw function paints frame t.

const SUN_CITY = { x: 0.632, y: 0.355 };   // sun in paint_city, plate fractions
const SUN_SKY = { x: 0.835, y: 0.33 };     // sun in paint_sky

/** Screen position of a plate-fraction point under cover-fit at the given zoom (anchor centre). */
function plateToScreen(fx, fy, zoom = 1) {
  const s = Math.max(W / 1920, H / 1080) * zoom;
  const pw = 1920 * s, ph = 1080 * s;
  return { x: W / 2 + (fx - 0.5) * pw, y: H / 2 + (fy - 0.5) * ph };
}

// ---------- 04 HEAT ----------
function drawHeat(t) {
  const t0 = SEC.heat, tHands = at('heat', 8), tCard = at('heat', 12), tOut = at('heat', 15);
  bg(C.black);
  if (t < tHands) {
    drawPlate(ctx, 'thermal_runner', t - t0, 0, 0, W, H, { zoom: 1.02 });
  } else {
    // Three 9:16 slivers, three moments of the same plate (Turner format play).
    const gap = 24 * U, sw = (W - 4 * gap) / 3;
    for (let i = 0; i < 3; i++) {
      const p = uiS(t - tHands + 0.12 - i * 0.1, 200);
      const x = gap + i * (sw + gap), y = H * (1 - p);
      drawPlate(ctx, 'thermal_hands', t - tHands + i * 1.2, x, y, sw, H, { zoom: 1.0, ax: 0.5 });
    }
  }
  scanlinePass(ctx, W, H, 0.22, Math.max(2, Math.round(3 * U)));
  // In-world readout: crosshair on the hottest point, value updates on the beat.
  if (t >= at('heat', 1) && t < tHands) {
    const b = Math.floor((t - t0) / BEAT), pt = plateToScreen(lerp(0.585, 0.47, ramp(t, t0, tHands)) + (hash(b, 1, 31) - 0.5) * 0.02, 0.15 + (hash(b, 2, 31) - 0.5) * 0.03, 1.02);
    const temp = 38 + 6 * hash(b, 3, 31);
    ctx.save(); ctx.strokeStyle = C.white; ctx.lineWidth = 3.5 * U; ctx.setLineDash([]);
    const r = 54 * U;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pt.x - r * 1.5, pt.y); ctx.lineTo(pt.x - r * 0.6, pt.y); ctx.moveTo(pt.x + r * 0.6, pt.y); ctx.lineTo(pt.x + r * 1.5, pt.y);
    ctx.moveTo(pt.x, pt.y - r * 1.5); ctx.lineTo(pt.x, pt.y - r * 0.6); ctx.moveTo(pt.x, pt.y + r * 0.6); ctx.lineTo(pt.x, pt.y + r * 1.5); ctx.stroke();
    font(500, 38 * U, F.ui); ctx.fillStyle = C.white; ctx.textAlign = 'left';
    ctx.fillText(`${temp.toFixed(1)}°`, pt.x + r * 1.7, pt.y + 10 * U);
    ctx.fillText('MAX', pt.x + r * 1.7, pt.y - 24 * U);
    ctx.restore();
  }
  // Magenta scribbles around the figure for two beats, then they snap off.
  if (t >= at('heat', 4) && t < at('heat', 6)) {
    const p = ramp(t, at('heat', 4), at('heat', 4) + 0.35);
    ctx.save(); ctx.strokeStyle = C.magenta; ctx.lineWidth = 5 * U; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let s = 0; s < 4; s++) {
      ctx.beginPath();
      const n = Math.floor(40 * p);
      for (let i = 0; i <= n; i++) {
        const a = i * 0.55 + s * 1.7, rad = (240 + 160 * hash(s, i, 41)) * U;
        const px = CX + Math.cos(a) * rad * 1.5 + (hash(s, i, 42) - 0.5) * 60 * U;
        const py = CY + Math.sin(a) * rad * 0.8 + (hash(s, i, 43) - 0.5) * 60 * U;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // Lime chapter card that clashes with the magenta on purpose: wipes up, then away.
  if (t >= tCard && t < tOut) {
    const pin = uiS(t - tCard, 220), pout = t >= tCard + 1.0 ? uiS(t - tCard - 1.0, 220) : 0;
    const y = H * (1 - pin) - H * pout;
    ctx.save(); ctx.translate(0, y);
    bg(C.lime);
    chapterLabel('04', 'Heat', 100 * U, 330 * U, 260 * U, C.magenta, typeS(t - tCard - 0.1));
    font(500, 26 * U, F.ui); ctx.fillStyle = C.magenta; ctx.textAlign = 'right';
    ctx.fillText('SEEN BY A CAMERA THAT ONLY SEES WARMTH', W - 100 * U, H - 100 * U);
    ctx.restore();
  }
  // Handoff: the white-hot sphere becomes the gold sun and travels to its place in the painting.
  if (t >= tOut) {
    const p = heavyS(t - tOut, 70);
    ctx.fillStyle = rgba(C.purple, p * 0.95); ctx.fillRect(0, 0, W, H);
    const sun = plateToScreen(SUN_CITY.x, SUN_CITY.y, 1.0);
    const x = lerp(CX, sun.x, p), y = lerp(CY * 0.9, sun.y, p), r = lerp(190 * U, 32 * U, p);
    ctx.fillStyle = mix('#FFFFFF', C.gold, p); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- 05 PAINT ----------
const HUES = [['#2A0A2A', '#FF2BD6'], ['#06200F', '#9BFF5A'], ['#2A0606', '#FF4A3A'], ['#061030', '#4AA8FF']];

function drawPaint(t) {
  const t0 = SEC.paint, tCut = at('paint', 12), tShrink = at('paint', 15);
  bg(C.purple);
  const zoom = 1 + 0.08 * ramp(t, t0, tCut);
  if (t < tCut) {
    drawPlate(ctx, 'paint_city', t - t0, 0, 0, W, H, { zoom, ax: SUN_CITY.x, ay: SUN_CITY.y });
  } else {
    // Keep the sun where it was: place paint_sky so its sun lands on paint_city's sun.
    const a = plateToScreen(SUN_CITY.x, SUN_CITY.y, zoom), bz = 1.75;
    const s = Math.max(W / 1920, H / 1080) * bz, pw = 1920 * s, ph = 1080 * s;
    const ox = a.x - SUN_SKY.x * pw, oy = a.y - SUN_SKY.y * ph;
    const im = plateFrame('paint_sky', t - tCut);
    if (im) ctx.drawImage(im, ox, oy, pw, ph);
  }
  // Stills montage: one hue per shot, four shots of a quarter second, then full colour.
  if (t >= at('paint', 2) && t < at('paint', 4)) {
    const [dark, light] = HUES[slot(t, at('paint', 2), 0.25) % 4];
    duotonePass(ctx, W, H, rgbOf(dark), rgbOf(light));
  }
  paperPass(ctx, W, H, 0.14, 9);
  // Pull quotes in display caps over the sky (Arco).
  const size = (V ? 150 : 190) * U;
  font(800, size);
  const q1 = at('paint', 6), q2 = at('paint', 10);
  if (t >= q1 && t < q2) riseLetters('MADE BY HAND.', CX, H * 0.3, size, t, q1, 0.03, C.white, 'center');
  if (t >= q2) riseLetters('FINISHED IN CODE.', CX, H * 0.3, size, t, q2, 0.03, C.white, 'center');
  if (t >= at('paint', 8)) chapterLabel('05', 'Paint', 100 * U, H - 110 * U, 200 * U, C.white, typeS(t - at('paint', 8)));
  grainPass(ctx, W, H, 0.05, Math.floor(t * FPS), 2);
  if (t >= tShrink) shrinkToPolaroid(t - tShrink);
}

/** The whole frame shrinks into a polaroid card that tips and falls toward the desk. */
function shrinkToPolaroid(age) {
  const p = heavyS(age, 80);
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  off.getContext('2d').drawImage(canvas, 0, 0);
  bg(mix(C.purple, '#3A2A1A', p));
  const card = polaroidRect(p);
  drawPolaroid(off, card.x, card.y, card.w, card.rot, 1);
}
/** Where the hero polaroid is at shrink progress p (0 = full frame, 1 = landed on the desk). */
function polaroidRect(p) {
  const w = lerp(W, (V ? 560 : 620) * U, p);
  return { x: lerp(0, CX - (V ? 280 : 310) * U - 40 * U, p), y: lerp(0, CY - 300 * U, p), w, rot: lerp(0, -0.06, p) };
}
/** Draw a polaroid (white border, image, drop shadow) with its top-left at (x, y) and width w. */
function drawPolaroid(img, x, y, w, rot, alpha = 1) {
  const b = w * 0.05, iw = w - 2 * b, ih = iw * 9 / 16, h = ih + b * 2 + w * 0.12;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40 * U; ctx.shadowOffsetY = 18 * U;
  ctx.fillStyle = '#FBFAF6'; ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = 'transparent';
  if (img) ctx.drawImage(img, b, b, iw, ih);
  ctx.restore();
}

// ---------- 06 DESK ----------
const DEAL = ['clay_macro', 'fire_wool', 'thermal_hands', 'paint_sky', 'ink_macro'];

function drawDesk(t) {
  const t0 = SEC.desk;
  drawPlate(ctx, 'desk', Math.min(t - t0, 4.9), 0, 0, W, H, { zoom: 1.0 });
  // Hero polaroid lands with a soft bounce; inside it the INK plate keeps looping, dithered.
  const land = uiS(t - t0, 90), card = polaroidRect(1);
  const off = document.createElement('canvas'); off.width = 640; off.height = 360;
  const oc = off.getContext('2d', { willReadFrequently: true });
  oc.fillStyle = C.white; oc.fillRect(0, 0, 640, 360);
  drawPlate(oc, 'ink_bloom', (t - t0 + 2) % 9.5, 0, 0, 640, 360);
  ditherPass(oc, 0, 0, 640, 360, 2);
  const y = card.y - 120 * U * (1 - land);
  drawPolaroid(off, card.x, y, card.w, card.rot);
  // Five more polaroids deal in, one per beat, fanned around the hero.
  DEAL.forEach((id, i) => {
    const tb = at('desk', 2 + i), p = uiS(t - tb, 140);
    if (p <= 0.001) return;
    const po = document.createElement('canvas'); po.width = 320; po.height = 180;
    drawPlate(po.getContext('2d'), id, 0, 0, 0, 320, 180);
    const ang = -1.1 + i * 0.62, rad = (V ? 520 : 640) * U;
    const cx = CX + Math.cos(ang) * rad, cy = CY - 40 * U + Math.sin(ang) * rad * 0.62;
    const w = 340 * U;
    drawPolaroid(po, cx - w / 2 + (1 - p) * 400 * U * Math.cos(ang), cy - w * 0.4 - (1 - p) * 300 * U, w, (hash(i, 0, 51) - 0.5) * 0.5, 1);
  });
  // Lockup stamped on the paper.
  if (t >= at('desk', 8)) {
    const p = uiS(t - at('desk', 8), 300), size = (V ? 180 : 220) * U, ly = H * (V ? 0.78 : 0.84);
    ctx.save(); ctx.translate(CX, ly); ctx.scale(lerp(1.25, 1, p), lerp(1.25, 1, p)); ctx.globalAlpha = p;
    font(800, size); ctx.fillStyle = C.ink; ctx.textAlign = 'center';
    ctx.fillText('MATTER', 0, 0);
    ctx.restore();
    font(500, 26 * U, F.ui);
    riseText('SIX MATERIALS · ONE LINE', CX, ly + 50 * U, 26 * U, typeS(t - at('desk', 9)), C.ink, 'center');
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(CX, ly + 100 * U, 10 * U * typeS(t - at('desk', 10)), 0, Math.PI * 2); ctx.fill();
  }
  // Dust motes in the window light.
  ctx.save(); ctx.fillStyle = 'rgba(255,250,230,0.55)';
  for (let i = 0; i < 40; i++) {
    const x = (hash(i, 0, 61) * 1.2 - 0.1) * W + 14 * U * Math.sin(t * 0.6 + i);
    const y = ((hash(i, 1, 61) * 1.2 - 0.1 + 0.01 * (t - t0)) % 1.2) * H;
    ctx.beginPath(); ctx.arc(x, y, (1 + 1.5 * hash(i, 2, 61)) * U, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  grainPass(ctx, W, H, 0.035, Math.floor(t * FPS), 2);
}
