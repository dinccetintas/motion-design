// OPEN (0-5s) and the studio lockup shared with CLOSE.
// A single accent line draws, folds into the studio mark, the wordmark slides out from
// behind it, then the mark rounds into Halcyon's sun and a navy iris opens the first project.

const MARK = { w: 120, h: 172, skew: 0.32 };

function lockupLayout() {
  const margin = V ? 70 : 160, gap = 56;
  const size = fitSize(STUDIO.name, 800, F.studio, 132, W - 2 * margin - MARK.w * 1.3 - gap);
  font(800, size, F.studio);
  const nameW = ctx.measureText(STUDIO.name).width;
  const groupW = MARK.w + gap + nameW;
  const x0 = CX - groupW / 2;
  return { size, nameW, markX: x0 + MARK.w / 2, markY: CY - 40, textX: x0 + MARK.w + gap, base: CY - 40 + size * 0.36 };
}

// Skewed rounded rectangle centred at (x, y).
function drawMark(x, y, w, h, skew, r, rot, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.transform(1, 0, -skew, 1, 0, 0);
  ctx.fillStyle = color; rr(-w / 2, -h / 2, w, h, r); ctx.fill();
  ctx.restore();
}

// Wordmark sliding out from behind the mark. p: 0 hidden -> 1 out. sub: tagline/web progress.
function drawLockupText(L, p, tagP, webP) {
  ctx.save();
  ctx.beginPath(); ctx.rect(L.markX + MARK.w / 2 + MARK.skew * MARK.h / 2 + 6, 0, W, H); ctx.clip();
  font(800, L.size, F.studio); ctx.fillStyle = C.white; ctx.textAlign = 'left';
  ctx.fillText(STUDIO.name, L.textX - (1 - p) * (L.nameW + 80), L.base);
  ctx.restore();
  const ts = V ? 34 : 38;
  font(400, ts, F.studio);
  riseText(STUDIO.tagline, L.textX + 2, L.base + ts * 2.1, ts, tagP, { color: rgba(C.white, 0.78) });
  if (webP !== undefined) {
    font(500, ts * 0.85, F.studio);
    riseText(STUDIO.web, L.textX + 2, L.base + ts * 4.0, ts * 0.85, webP, { color: C.accent });
    font(400, ts * 0.85, F.studio);
    riseText(STUDIO.contact, L.textX + 2, L.base + ts * 5.4, ts * 0.85, typeS(webP > 0 ? (webP - 0.15) * 3 : 0), { color: rgba(C.white, 0.78) });
  }
}

function drawOpen(t) {
  bg(C.black);
  const L = lockupLayout(), S = halLayout();
  const b = (n) => at('open', 0) + (1 + 6 * n) / 11;           // beat n of the film
  // Line draw (beat 0 -> 2), then fold into the mark (beat 2).
  const x0 = V ? 70 : 140, len = (W - 2 * x0) * typeS(t - b(0), 28);
  const p = uiS(t - b(2), 200), spin = heavyS(t - b(2), 70);
  let x = lerp(x0 + len / 2, L.markX, p), y = L.markY;
  let w = lerp(len, MARK.w, p), h = lerp(4, MARK.h, p), sk = lerp(0, MARK.skew, p), r = lerp(2, 10, p);
  let col = mix(C.accent, C.white, typeS(t - b(2), 160));
  // Mark -> Halcyon sun (beat 7), turning teal (beat 8).
  const c = uiS(t - b(7), 180);
  x = lerp(x, S.sunX, c); y = lerp(y, S.sunY, c);
  w = lerp(w, S.sunD, c); h = lerp(h, S.sunD, c); sk = lerp(sk, 0, c); r = lerp(r, S.sunD / 2, c);
  col = mix(col, C.hTeal, typeS(t - b(8), 120));
  // Navy iris from the sun (beat 8) fills the frame by 5s.
  const rmax = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([a, d]) => Math.hypot(a - S.sunX, d - S.sunY)));
  const iris = rmax * 1.08 * heavyS(t - b(8), 90);
  if (iris > 1) { ctx.fillStyle = C.hNavy; ctx.beginPath(); ctx.arc(S.sunX, S.sunY, iris, 0, Math.PI * 2); ctx.fill(); }
  const out = 1 - typeS(t - b(7) + 0.05, 240);
  drawLockupText(L, typeS(t - b(3), 160) * out + (t < b(7) ? 0 : 0), typeS(t - b(5), 200) * out);
  if (len > 0.5) drawMark(x, y, w, h, sk, r, -Math.PI * spin, col);
}
