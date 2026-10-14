// PROJECT 1, HALCYON (5-17s): logo reveal, then the logo unfolds into a motion system:
// type behaviour on baselines, colour panels, a rhythmic icon set. Hands off its card icon.

function halLayout() {
  const sunD = 240;
  font(600, 150, F.hal);
  const wordW = ctx.measureText('Halcyon').width;
  if (V) return { sunD, sunX: CX, sunY: CY - 230, wordX: CX - wordW / 2, wordBase: CY + 150, wordW };
  const gap = 72, x0 = CX - (sunD + gap + wordW) / 2;
  return { sunD, sunX: x0 + sunD / 2, sunY: CY - 30, wordX: x0 + sunD + gap, wordBase: CY - 30 + 52, wordW };
}

const HAL_GAPS = [0, 0.17, 0.31, 0.43];  // horizon + three calm-water bands, as fractions of D

// Halcyon mark: teal sun, lower half cut by navy bands. g[i] = draw progress of band i.
function drawHalLogo(x, y, D, g, bandCol = C.hNavy) {
  ctx.fillStyle = C.hTeal; ctx.beginPath(); ctx.arc(x, y, D / 2, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, D / 2 + 1, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = bandCol;
  HAL_GAPS.forEach((f, i) => {
    const w = D * 1.1 * clamp(g[i], 0, 1.2), th = D * (i === 0 ? 0.05 : 0.045);
    if (w > 0.5) ctx.fillRect(x - w / 2, y + f * D - th / 2, w, th);
  });
  ctx.restore();
}

const HAL_ICONS = [
  { name: 'Cards', p: [{ rr: [-45, -30, 90, 60, 10] }, { l: [[-45, -12], [45, -12]], a: 1 }, { l: [[-30, 14], [-8, 14]] }] },
  { name: 'Security', p: [{ l: [[-34, -38], [34, -38], [34, 2], [0, 40], [-34, 2], [-34, -38]] }, { l: [[-15, 0], [-3, 13], [18, -13]], a: 1 }] },
  { name: 'Insights', p: [{ l: [[-40, -40], [-40, 40], [40, 40]] }, { l: [[-26, 20], [-8, 0], [8, 10], [32, -24]], a: 1 }] },
  { name: 'Transfers', p: [{ l: [[-36, -12], [36, -12]] }, { l: [[20, -28], [36, -12], [20, 4]] }, { l: [[36, 16], [-36, 16]], a: 1 }, { l: [[-20, 0], [-36, 16], [-20, 32]], a: 1 }] },
  { name: 'Savings', p: [{ arc: [0, 0, 38] }, { l: [[-38, 0], [38, 0]], a: 1 }, { l: [[-28, 14], [28, 14]] }] },
  { name: 'Alerts', p: [{ arc: [0, -4, 28, Math.PI, 2 * Math.PI] }, { l: [[-28, -4], [-28, 18], [-37, 27], [37, 27], [28, 18], [28, -4]] }, { l: [[-9, 37], [9, 37]], a: 1 }] },
];
function primPts(q) {
  if (q.l) return q.l;
  if (q.arc) return arcPts(q.arc[0], q.arc[1], q.arc[2], q.arc[3] ?? -Math.PI / 2, q.arc[4] ?? Math.PI * 1.5);
  const [x, y, w, h, r] = q.rr;           // rounded rect as points, clockwise from top-left
  return [...arcPts(x + w - r, y + r, r, -Math.PI / 2, 0, 8), ...arcPts(x + w - r, y + h - r, r, 0, Math.PI / 2, 8),
    ...arcPts(x + r, y + h - r, r, Math.PI / 2, Math.PI, 8), ...arcPts(x + r, y + r, r, Math.PI, Math.PI * 1.5, 8), [x + r, y]];
}
function iconPos(i) {
  const col = V ? i % 2 : i % 3, row = V ? Math.floor(i / 2) : Math.floor(i / 3);
  return V ? [CX + (col - 0.5) * 430, CY - 470 + row * 440] : [CX + (col - 1) * 400, CY - 170 + row * 350];
}
function vecRect() {
  return V ? { w: 960, h: 1600, x: 60, y: 160 } : { w: 1520, h: 950, x: 200, y: 65 };
}

function drawHalcyon(t) {
  const b = (n) => at('hal', n);
  const S = halLayout();
  bg(mix(C.hNavy, C.vBg, typeS(t - b(21), 90)));

  // --- Logo reveal (b0-b6) and unfold (b7) ---
  const u = heavyS(t - b(7), 50);
  const D = lerp(S.sunD, S.sunD * 0.55, u);
  const lx = lerp(S.sunX, V ? 150 : 230, u), ly = lerp(S.sunY, V ? 620 : CY - 10, u);
  const bands = HAL_GAPS.map((_, i) => typeS(t - b(i === 0 ? 0.3 : i + 0.3), 120));
  const typeLayer = t < at('hal', 15.9);
  if (typeLayer) {
    const wordOut = 1 - typeS(t - b(6.6), 200);
    font(600, 150, F.hal);
    if (wordOut >= 1) riseLetters('Halcyon', S.wordX, S.wordBase, 150, t, b(4), 0.05, C.hSand);
    else riseText('Halcyon', S.wordX, S.wordBase, 150, wordOut, { color: C.hSand });
    font(300, 40, F.hal);
    const dX = V ? CX : S.wordX + 4, dY = S.wordBase + 80;
    ctx.textAlign = V ? 'center' : 'left';
    riseText('Spec project · brand motion system', dX, dY, 40, typeS(t - b(6), 200) * wordOut, { color: C.hTeal, align: V ? 'center' : 'left' });

    // Baselines grow out of the logo's bands, words land on them.
    const tx = V ? 110 : 430, x1 = W - (V ? 90 : 200);
    const bases = V ? [930, 1150, 1370] : [CY - 140, CY + 40, CY + 220];
    bases.forEach((by, i) => {
      const yy = lerp(ly + HAL_GAPS[i + 1] * D, by, heavyS(t - b(7.4), 60));
      const p = typeS(t - b(7.2) - i * 0.08, 60);
      if (p > 0.001) { ctx.strokeStyle = rgba(C.hSand, 0.35); ctx.lineWidth = 2; strokePartial([[lx + D / 2 + 20, yy], [x1, yy]], p); }
    });
    const words = ['Money,', 'made', 'calm.'];
    words.forEach((w, i) => {
      const stress = i === 2 && t >= b(11);
      const pulse = i === 2 ? uiTrack(t, [[0, 1], [b(11), 1.06], [b(11) + 0.22, 1]]) : 1;
      font(stress ? 600 : 300, 150, F.hal);
      ctx.save(); ctx.translate(tx, bases[i]); ctx.scale(pulse, pulse);
      riseText(w, 0, -14, 150, typeS(t - b(8 + i), 180), { color: stress ? C.hTeal : C.hSand });
      ctx.restore();
    });
    font(400, V ? 26 : 28, F.mono);
    riseText('Fraunces 300 → 600 on stress · spring k200, no overshoot', tx + 4, bases[2] + 70, 28, typeS(t - b(11.5), 200), { color: rgba(C.hSand, 0.7) });
  }

  // --- Icon set (b16-b20), then handoff (b21) ---
  if (t >= b(15.5)) {
    const pulse = uiTrack(t, [[0, 1], [b(19), 1.12], [b(19) + 0.2, 1], [b(20), 1.12], [b(20) + 0.2, 1]]);
    const hand = uiS(t - b(21), 150);
    HAL_ICONS.forEach((ic, i) => {
      const [x, y] = iconPos(i), ti = b(16 + i * 0.5);
      const exit = i === 0 ? 0 : typeS(t - b(21) + 0.03 * i, 260);
      const sc = 1.6 * pulse * (1 - exit);
      if (sc < 0.01) return;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 7 / 1.6;
      ic.p.forEach((q, j) => {
        if (i === 0 && q.rr) return;                 // drawn below as the handoff shape
        const p = typeS(t - ti - j * 0.09, 90) * (i === 0 ? 1 - typeS(t - b(21), 300) : 1);
        ctx.strokeStyle = q.a ? C.hTeal : C.hSand;
        strokePartial(primPts(q), p);
      });
      ctx.restore();
      font(300, 34, F.hal);
      riseText(ic.name, x, y + 128, 34, typeS(t - ti - 0.15, 200) * (1 - typeS(t - b(20.6) + 0.02 * i, 260)), { color: C.hSand, align: 'center' });
    });
    // Card outline -> Vector app window.
    const [x, y] = iconPos(0), R = vecRect();
    const s0 = 1.6 * pulse, p0 = typeS(t - b(16), 90);
    const w = lerp(90 * s0, R.w, hand), h = lerp(60 * s0, R.h, hand), r = lerp(10 * s0, 22, hand);
    const cx = lerp(x, R.x + R.w / 2, hand), cy = lerp(y, R.y + R.h / 2, hand);
    if (hand > 0.001) { ctx.fillStyle = mix(C.hNavy, C.vGraph, hand); rr(cx - w / 2, cy - h / 2, w, h, r); ctx.fill(); }
    ctx.save(); ctx.translate(cx - w / 2, cy - h / 2);
    ctx.lineWidth = lerp(7, 2, hand); ctx.strokeStyle = mix(C.hSand, C.vLine, hand);
    const rect = { rr: [0, 0, w, h, r] };
    strokePartial(primPts(rect), p0);
    ctx.restore();
  }

  // --- Logo (drawn over baselines) ---
  if (typeLayer) drawHalLogo(lx, ly, D, bands);

  // --- Colour panels (b12-b15), retract at b16 ---
  const sw = [['Sea teal', C.hTeal, C.hNavy], ['Warm sand', C.hSand, C.hNavy], ['Coral', C.hCoral, C.hNavy], ['Deep ink', C.hInk, C.hSand]];
  sw.forEach(([name, col, ink], i) => {
    const p = uiS(t - b(12 + i), 240) - typeS(t - b(16) - 0.07 * i, 160);
    if (p <= 0.01) return;
    const inP = t < b(16) ? 1 : 0;
    ctx.fillStyle = col;
    let tx, ty;
    if (V) {
      const y = (i * H) / 4, retract = t >= b(16);
      const w = W * clamp(p, 0, 1.06);
      ctx.fillRect(retract ? W - w : 0, y, w, H / 4 + 1);
      tx = 70; ty = y + H / 4 - 90;
    } else {
      const x = (i * W) / 4, retract = t >= b(16);
      const h = H * clamp(p, 0, 1.06);
      ctx.fillRect(x, retract ? 0 : H - h, W / 4 + 1, h);
      tx = x + 44; ty = H - 120;
    }
    const lp = typeS(t - b(12.3 + i), 200) * inP;
    font(600, 48, F.hal); riseText(name, tx, ty, 48, lp, { color: ink });
    font(400, 30, F.mono); riseText(col.toUpperCase(), tx, ty + 50, 30, lp, { color: ink });
  });
}
