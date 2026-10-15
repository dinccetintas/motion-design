// showcase/scenes_a.js — INK, CLAY and FIRE (0–24 s). Each draw function paints frame t.

const INK_T0 = at('ink', 1);           // the ink plate starts on beat 1
const SPHERE = { x: 0.50, y: 0.64, r: 0.115 }; // clay_hands sphere, fractions of H for r

/** Screen position of a plate-fraction point under cover-fit (anchor centre). */
function coverPoint(fx, fy, fr) {
  const sc = Math.max(W / 1920, H / 1080);
  const pw = 1920 * sc, ph = 1080 * sc;
  return { x: W / 2 + (fx - 0.5) * pw, y: H / 2 + (fy - 0.5) * ph, r: fr * ph };
}
/** The dark sphere in fire_wool. */
const fireSphere = () => coverPoint(0.5, 0.36, 0.095);
/** Where the clay sphere sits on screen (cover-fit of a 16:9 plate). */
function sphereScreen() {
  const s = Math.max(W / 1920, H / 1080);
  const pw = 1920 * s, ph = 1080 * s, ox = (W - pw) / 2, oy = (H - ph) / 2;
  return { x: ox + SPHERE.x * pw, y: oy + SPHERE.y * ph, r: SPHERE.r * ph };
}

// ---------- 01 INK ----------
function drawInk(t) {
  const beat = (t - INK_T0) / BEAT;
  if (t < INK_T0) {                                   // the dot
    bg(C.black);
    const r = 10 * U + 34 * U * uiS(t - 0.05, 120);
    ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (t >= at('ink', 12)) return drawInkCard(t);
  bg(C.white);
  // Strobe run 2.0–2.5: six inserts of the macro plate with speed lines.
  const strobe = within(t, at('ink', 4), at('ink', 4) + 0.48) && slot(t, at('ink', 4), 0.08) % 2 === 0;
  if (strobe) {
    drawPlate(ctx, 'ink_macro', (slot(t, at('ink', 4), 0.08) / 2) * 0.3, 0, 0, W, H, { zoom: 1.15 });
    speedLines(ctx, CX, CY, 90, slot(t, at('ink', 4), 0.08), C.black, 160 * U, 1500 * U, 4 * U);
  } else {
    drawPlate(ctx, 'ink_bloom', t - INK_T0, 0, 0, W, H);
  }
  // Dither cell halves on every second beat: 16 → 8 → 4 → 2.
  const cell = Math.max(2, 16 >> Math.floor(Math.max(0, beat) / 2));
  ditherPass(ctx, 0, 0, W, H, Math.round(cell * U));
  // Title revealed by the ink: white letters XOR the dithered field.
  if (t >= at('ink', 8)) {
    const size = (V ? 300 : 420) * U;
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    font(800, size);
    riseLetters('MATTER', CX, CY + size * 0.34, size, t, at('ink', 8), 0.04, '#FFFFFF', 'center');
    ctx.restore();
  }
  if (within(t, at('ink', 8), at('ink', 8) + 1 / FPS)) bg('#FFFFFF');   // one-frame flash
}

/** Flat white chapter card for INK, then the iris handoff into the clay sphere. */
function drawInkCard(t) {
  const t0 = at('ink', 12), tIris = at('ink', 15);
  bg(C.cobalt);
  const sp = sphereScreen();
  if (t >= tIris) {                                   // white card shrinks to the sphere's disc
    const p = heavyS(t - tIris, 90);
    const r = lerp(Math.hypot(W, H) / 2, sp.r, p);
    ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(lerp(CX, sp.x, p), lerp(CY, sp.y, p), r, 0, Math.PI * 2); ctx.fill();
    return;
  }
  bg(C.white);
  const wipe = uiS(t - t0, 180);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * wipe, H); ctx.clip();
  const m = 100 * U;
  chapterLabel('01', 'Ink', m, m + 230 * U, 260 * U, C.black, typeS(t - t0 - 0.1));
  font(500, 26 * U, F.ui); ctx.fillStyle = C.black;
  riseText('EVERY FRAME DRAWN BY A MATERIAL', m, H - m, 26 * U, typeS(t - t0 - 0.3), C.black);
  font(800, 26 * U); tracked('ONE LINE · SIX MATERIALS', W - m, H - m, 3 * U, 'right');
  // The dot waits at the sphere's future position.
  ctx.fillStyle = C.black; ctx.beginPath(); ctx.arc(sp.x, sp.y, 26 * U * typeS(t - t0 - 0.5), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- 02 CLAY ----------
const PATCH_BG = [C.cobalt, C.sand, C.coral, C.cobalt, C.sand, C.coral, C.cobalt, C.sand];

function drawClay(t) {
  const t0 = SEC.clay, lt = Math.floor((t - t0) * 15) / 15;     // held on twos
  const beat = (t - t0) / BEAT;
  const bgi = Math.min(PATCH_BG.length - 1, Math.floor(beat / 2));
  bg(PATCH_BG[bgi]);
  const m = 120 * U, tGrow = at('clay', 5), tMacro = at('clay', 6);
  const grow = t >= tGrow ? uiS(t - tGrow, 120) : 0;
  const x = lerp(m, 0, grow), y = lerp(m, 0, grow), w = lerp(W - 2 * m, W, grow), h = lerp(H - 2 * m, H, grow);
  const rad = lerp(48 * U, 0, grow);
  ctx.save();
  rr(x, y, w, h, rad); ctx.clip();
  if (t < tMacro) drawPlate(ctx, 'clay_hands', lt, x, y, w, h, { zoom: 1 + 0.04 * ramp(t, t0, tMacro) });
  else drawPlate(ctx, 'clay_macro', lt - (tMacro - t0), x, y, w, h, { zoom: 1 + 0.06 * ramp(t, tMacro, SEC.fire) });
  paperPass(ctx, W, H, 0.08, 5);
  ctx.restore();
  // Stitched patch edge (Moncler device) until the patch fills the frame.
  if (grow < 0.98) {
    ctx.save(); ctx.globalAlpha = 1 - grow;
    ctx.setLineDash([10 * U, 8 * U]); ctx.lineWidth = 3 * U; ctx.strokeStyle = rgba(C.white, 0.85);
    rr(x + 14 * U, y + 14 * U, w - 28 * U, h - 28 * U, rad - 10 * U); ctx.stroke();
    ctx.restore();
  }
  // Label and ruler.
  const labelCol = bgi % 3 === 1 ? C.black : C.white;
  if (t >= at('clay', 2) && t < tGrow) {
    chapterLabel('02', 'Clay', m + 40 * U, m + 220 * U, 240 * U, labelCol, typeS(t - at('clay', 2)));
    drawRuler(t, m + 40 * U, H - m - 40 * U, w - 80 * U, labelCol);
  }
  // Word stamps on the macro.
  const words = ['PRESS', 'ROLL', 'HOLD'];
  words.forEach((wd, i) => {
    const ts = at('clay', 10 + i * 2);
    if (t < ts || t >= Math.min(at('clay', 14), at('clay', 12 + i * 2))) return;
    const p = uiS(t - ts, 300), size = 420 * U, wob = (hash(i, Math.floor(t * 8), 11) - 0.5) * 6 * U;
    ctx.save();
    ctx.translate(CX + (i - 1) * 0 + wob, CY + 110 * U + wob * 0.5);
    ctx.scale(lerp(1.35, 1, p), lerp(1.35, 1, p));
    ctx.globalAlpha = p;
    font(800, size); ctx.fillStyle = C.cobalt; ctx.textAlign = 'center';
    ctx.fillText(wd, 0, 0);
    ctx.restore();
  });
  // Handoff: the sphere darkens to a disc and the world drops to midnight.
  if (t >= at('clay', 14)) {
    const p = heavyS(t - at('clay', 14), 60);
    ctx.fillStyle = rgba(C.midnight, p); ctx.fillRect(0, 0, W, H);
    const fs = fireSphere();
    ctx.fillStyle = C.black;
    ctx.beginPath(); ctx.arc(lerp(CX, fs.x, p), lerp(CY, fs.y, p), lerp(420 * U, fs.r, p), 0, Math.PI * 2); ctx.fill();
  }
}

/** Hairline ruler with mm ticks; the readout counts as the clay is rolled. */
function drawRuler(t, x, y, w, color) {
  const p = typeS(t - at('clay', 2) - 0.2);
  if (p <= 0.001) return;
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2 * U;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * p, y); ctx.stroke();
  const n = 60;
  for (let i = 0; i <= n * p; i++) {
    const tx = x + (i / n) * w, th = (i % 10 === 0 ? 22 : i % 5 === 0 ? 14 : 8) * U;
    ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx, y - th); ctx.stroke();
  }
  font(500, 22 * U, F.ui); ctx.textAlign = 'right';
  const mm = 48 + 14 * Math.sin((t - SEC.clay) * 1.7);
  ctx.fillText(`Ø ${mm.toFixed(1)} MM`, x + w, y - 34 * U);
  ctx.restore();
}

// ---------- 03 FIRE ----------
function drawFire(t) {
  const t0 = SEC.fire;
  bg(C.midnight);
  const burst = within(t, at('fire', 4), at('fire', 8)) && slot(t, at('fire', 4), 0.25) % 2 === 1;
  if (burst) drawPlate(ctx, 'fire_skier', (t - at('fire', 4)) * 0.6, 0, 0, W, H, { zoom: 1.08 });
  else drawPlate(ctx, 'fire_wool', t - t0, 0, 0, W, H, { zoom: 1 + 0.05 * ramp(t, t0, SEC.heat) });
  // Light streaks: six amber lines fired on every beat, each living one second.
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let b = 0; b < 16; b++) {
    const tb = at('fire', b), age = t - tb;
    if (age < 0 || age > 1) continue;
    for (let i = 0; i < 6; i++) {
      const y = H * (0.15 + 0.7 * hash(b, i, 21)), speed = (1400 + 900 * hash(b, i, 22)) * U;
      const x1 = -200 * U + speed * age, len = (260 + 520 * hash(b, i, 23)) * U * (1 - age * 0.5);
      ctx.strokeStyle = rgba(C.amber, 0.95 * (1 - age)); ctx.lineWidth = (3 + 5 * hash(b, i, 24)) * U;
      ctx.beginPath(); ctx.moveTo(x1 - len, y); ctx.lineTo(x1, y); ctx.stroke();
    }
  }
  ctx.restore();
  // Counter: frames lit by fire.
  if (t >= at('fire', 8) && t < at('fire', 15)) {
    const v = lerp(1, 240, ramp(t, at('fire', 8), at('fire', 14)));
    font(800, 260 * U); ctx.fillStyle = C.amber;
    const ox = V ? CX - 300 * U : W - 640 * U, oy = V ? H * 0.82 : H * 0.56;
    odometer(v, 4, ox, oy, 260 * U, C.amber);
    font(500, 24 * U, F.ui); ctx.fillStyle = C.amber; ctx.textAlign = 'left';
    ctx.fillText('FRAMES LIT BY FIRE', ox, oy + 48 * U);
  }
  if (t >= at('fire', 12)) chapterLabel('03', 'Fire', 100 * U, 320 * U, 240 * U, C.amber, typeS(t - at('fire', 12)));
  if (t >= at('fire', 8) && t < at('fire', 15)) aberrationPass(ctx, W, H, 3 * U);
  // Handoff: the hot core blooms white and fills the frame.
  if (t >= at('fire', 15)) {
    const p = heavyS(t - at('fire', 15), 110);
    const g = ctx.createRadialGradient(CX, CY * 0.9, 0, CX, CY * 0.9, lerp(60 * U, Math.hypot(W, H), p));
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, rgba(C.amber, 0.9)); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}
