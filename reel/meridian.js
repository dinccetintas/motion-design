// PROJECT 3, MERIDIAN (29-41s): data story. Dot map from the origin port, routes draw out,
// stats roll in, bars grow and morph into a line, the last point floods the frame with the key
// stat, then the amber field irises down into Aura's earbud.

const mb = (n) => at('mer', n);
const MER_PORTS = [['Rotterdam', 4.5, 51.9], ['Singapore', 103.8, 1.3], ['Santos', -46.3, -23.9],
  ['Los Angeles', -118.2, 33.7], ['Dubai', 55.3, 25.2], ['Shanghai', 121.5, 31.2]];
const MER_STATS = [['##,###', 18400, 'shipments a day'], ['###', 142, 'ports connected'], ['##.#%', 994, 'on-time arrival']];
const MER_BARS = [42, 48, 51, 57, 63, 70, 76, 84];

function merLayout() {
  return V ? { k: (W * 1.2) / 360, cx: CX, cy: H * 0.4, lon0: 2, lat0: 10, dot: 1.9 }
           : { k: (W * 0.84) / 360, cx: CX, cy: CY + 10, lon0: 2, lat0: 10, dot: 2.5 };
}
function merProject(lon, lat, m) { return [m.cx + (lon - m.lon0) * m.k, m.cy - (lat - m.lat0) * m.k]; }

function merRoute(i, m) {
  const a = merProject(MER_PORTS[0][1], MER_PORTS[0][2], m), b = merProject(MER_PORTS[i][1], MER_PORTS[i][2], m);
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return quadPts(a, [mx, my - len * 0.28], b);
}

function drawMerMap(t, m) {
  const port = merProject(MER_PORTS[0][1], MER_PORTS[0][2], m);
  ctx.fillStyle = rgba(C.mFoam, 0.42);
  for (const [lon, lat] of LAND) {
    const [x, y] = merProject(lon, lat, m);
    const d = Math.hypot(x - port[0], y - port[1]) / (V ? 1100 : 1800);
    const r = m.dot * typeS(t - mb(0.15) - d * 1.1, 150);
    if (r > 0.05) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
  }
  const fs = V ? 28 : 30;
  font(500, fs, F.mer);
  for (let i = 1; i < MER_PORTS.length; i++) {
    const t0 = mb(2 + i), pts = merRoute(i, m), p = typeS(t - t0, 14);
    ctx.strokeStyle = C.mAmber; ctx.lineWidth = V ? 2.5 : 3; ctx.lineCap = 'round';
    strokePartial(pts, p);
    const end = pts[pts.length - 1], arrive = uiS(t - t0 - 0.9, 260);
    if (arrive > 0.01) { ctx.fillStyle = C.mPaper; ctx.beginPath(); ctx.arc(end[0], end[1], 7 * arrive, 0, 6.283); ctx.fill(); }
    const right = MER_PORTS[i][1] > 40 || (V && MER_PORTS[i][1] > 0);
    const lx = end[0] + (right ? 16 : -16), ly = end[1] + (MER_PORTS[i][0] === 'Singapore' ? 34 : -14);
    riseText(MER_PORTS[i][0], lx, ly, fs, typeS(t - t0 - 0.95, 200), { color: C.mPaper, align: right ? 'left' : 'right' });
    if (p > 0.98) {                                   // ship travelling the lane
      const s = ((t - t0 - 1.2) * 0.22 + i * 0.17) % 1;
      if (s > 0) { const q = pts[Math.floor(s * (pts.length - 1))]; ctx.fillStyle = C.mPaper; ctx.beginPath(); ctx.arc(q[0], q[1], 4.5, 0, 6.283); ctx.fill(); }
    }
  }
  ctx.fillStyle = C.mAmber; ctx.beginPath(); ctx.arc(port[0], port[1], 14, 0, 6.283); ctx.fill();
  riseText('Rotterdam', port[0] - 22, port[1] - 22, fs, typeS(t - mb(1), 200), { color: C.mPaper, align: 'right' });
}

function drawMerStats(t) {
  MER_STATS.forEach(([fmt, val, label], i) => {
    const t0 = mb(8 + i), p = typeS(t - t0, 200), n = typeS(t - t0, 18);
    const x = V ? 90 : 230 + i * 540, y = V ? 1090 + i * 250 : H - 210, size = V ? 150 : 140;
    if (p <= 0.001) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y - size * 0.8, W, size * 0.88); ctx.clip();
    ctx.translate(0, (1 - p) * size);
    font(800, size, F.mer); odometer(fmt, Math.round(val * n), x, y, size, i === 0 ? C.mAmber : C.mPaper);
    ctx.restore();
    font(500, 34, F.mer); riseText(label, x + 4, y + 52, 34, typeS(t - t0 - 0.15, 200), { color: C.mFoam });
  });
}

function merChart() {
  return V ? { x: 110, w: 860, base: 1520, h: 880, title: 470 } : { x: 300, w: 1320, base: 900, h: 540, title: 250 };
}
function merBarTops(ch) {
  const slot = ch.w / MER_BARS.length;
  return MER_BARS.map((v, i) => [ch.x + slot * (i + 0.5), ch.base - (v / 90) * ch.h]);
}

function drawMerChart(t) {
  const ch = merChart(), slot = ch.w / MER_BARS.length, tops = merBarTops(ch), bw = slot * 0.56;
  font(500, V ? 40 : 44, F.mer);
  riseText('Quarterly shipments, thousands', ch.x, ch.title, 44, typeS(t - mb(10.8), 200), { color: C.mPaper });
  ctx.fillStyle = rgba(C.mFoam, 0.35); ctx.fillRect(ch.x, ch.base, ch.w * typeS(t - mb(10.8), 60), 2);
  MER_BARS.forEach((v, i) => {
    const g = uiS(t - mb(11) - i * BEAT * 0.25, 200), mo = typeS(t - mb(14) - i * 0.04, 200);
    const [x, top] = tops[i], full = ch.base - top, h = full * g;
    const bodyTop = ch.base - h, bodyBot = lerp(ch.base, bodyTop, mo);
    if (h > 0.5 && bodyBot - bodyTop > 0.5) { ctx.fillStyle = i === 7 ? C.mAmber : C.mFoam; rr(x - bw / 2, bodyTop, bw, bodyBot - bodyTop, 6); ctx.fill(); }
    if (mo > 0.01 && t < mb(17) + 0.02 * (i === 7)) { ctx.fillStyle = C.mAmber; ctx.beginPath(); ctx.arc(x, top, 10 * mo, 0, 6.283); ctx.fill(); }
    font(500, 30, F.mer);
    riseText(String(v), x, bodyTop - 18, 30, typeS(t - mb(11.3) - i * 0.1, 200), { color: C.mPaper, align: 'center' });
    font(500, V ? 26 : 30, F.mer);
    riseText(`Q${(i % 4) + 1} '${i < 4 ? 24 : 25}`, x, ch.base + 44, 30, typeS(t - mb(11) - i * 0.05, 200), { color: rgba(C.mPaper, 0.75), align: 'center' });
  });
  ctx.strokeStyle = C.mAmber; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  strokePartial(tops, typeS(t - mb(14.6), 30));
}

function drawKeyStat(t, out) {
  const big = V ? 400 : 520;
  const x = V ? 80 : 150, y = V ? CY + 20 : CY + 175;
  font(800, big, F.mer); riseText('38%', x, y, big, typeS(t - mb(18), 160) * out, { color: C.mInk });
  const tx = V ? 90 : 1010, ty = V ? CY + 170 : CY - 40, s = V ? 64 : 72;
  font(500, s, F.mer);
  riseText('faster door-to-door', tx, ty, s, typeS(t - mb(18.5), 200) * out, { color: C.mInk });
  riseText('delivery, network-wide', tx, ty + s * 1.05, s, typeS(t - mb(18.8), 200) * out, { color: C.mInk });
  font(500, 34, F.mer);
  riseText('Average transit time, 2024 → 2025', tx, ty + s * 1.05 + 80, 34, typeS(t - mb(19.3), 200) * out, { color: rgba(C.mInk, 0.75) });
}

function drawMeridian(t) {
  const m = merLayout();
  if (t < mb(21)) bg(C.mInk); else drawAuraScene(at('aura', 0));

  if (t < mb(18)) {
    ctx.save();
    const up = heavyS(t - mb(7.6), 45), gone = heavyS(t - mb(10.3), 40);
    const sc = 1 - (V ? 0.1 : 0.3) * up;
    ctx.translate(CX, m.cy); ctx.scale(sc, sc); ctx.translate(-CX, -m.cy + (V ? -170 : -330) * up / sc - H * 1.1 * gone);
    drawMerMap(t, m);
    ctx.restore();
    if (t >= mb(7.6)) { ctx.save(); ctx.translate(0, -H * 1.1 * gone); drawMerStats(t); ctx.restore(); }
    if (t >= mb(10.5)) drawMerChart(t);
  } else if (t < mb(21)) {
    drawMerChart(t);
  }

  // Last point lifts and floods the frame (b17), stat lands (b18), iris closes (b21).
  if (t >= mb(17)) {
    const top = merBarTops(merChart())[7];
    const f = heavyS(t - mb(17), 90);
    const x = lerp(top[0], CX, f), y = lerp(top[1], CY, f);
    const rmax = Math.hypot(W, H) * 0.62;
    const close = heavyS(t - mb(21), 70), disc = auraFrontDisc();
    const r = lerp(lerp(10, rmax, f), disc.r, close);
    ctx.fillStyle = C.mAmber; ctx.beginPath(); ctx.arc(lerp(x, disc.x, close), lerp(y, disc.y, close), r, 0, 6.283); ctx.fill();
    if (t >= mb(17.6)) drawKeyStat(t, 1 - typeS(t - mb(20.4), 220));
  }
}
