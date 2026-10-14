// CLOSE (53-60s): tiles from all four projects fly into one grid, collapse into the studio
// mark, and the lockup holds with contact details.

const CL = { tiles: [] };
const cb = (n) => at('close', n);
// [section draw, representative time] for each tile, in grid order. Tile 11 is where Aura lands.
const CL_SHOTS = [
  [drawHalcyon, 8.4], [drawHalcyon, 11.2], [drawHalcyon, 13.5], [drawHalcyon, 15.25],
  [drawVector, 22.2], [drawVector, 24.4], [drawVector, 27.0], [drawMeridian, 33.2],
  [drawMeridian, 34.5], [drawMeridian, 38.0], [drawMeridian, 40.0], [drawAuraScene, 52.999],
];

function closeTileRect(i) {
  if (V) {
    const gap = 20, h = (H - 2 * 150 - 3 * gap) / 4, w = (h * 9) / 16, x0 = CX - (3 * w + 2 * gap) / 2;
    return { x: x0 + (i % 3) * (w + gap), y: 150 + Math.floor(i / 3) * (h + gap), w, h };
  }
  const gap = 24, w = (W - 2 * 120 - 3 * gap) / 4, h = (w * 9) / 16, y0 = CY - (3 * h + 2 * gap) / 2;
  return { x: 120 + (i % 4) * (w + gap), y: y0 + Math.floor(i / 4) * (h + gap), w, h };
}

// Thumbnails are fixed renders of earlier moments (time-independent, so no frame state).
function initClose() {
  CL.tiles = CL_SHOTS.map(([fn, t]) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d');
    withCtx(cx, () => { cx.textBaseline = 'alphabetic'; fn(t); });
    return c;
  });
}

function drawClose(t) {
  bg(C.black);
  const L = lockupLayout();
  const cols = V ? 3 : 4;
  CL.tiles.forEach((img, i) => {
    const R = closeTileRect(i), col = i % cols, row = Math.floor(i / cols), rows = V ? 4 : 3;
    let dx = 0, dy = 0;
    if (col === 0) dx = -W * 0.75; else if (col === cols - 1) dx = W * 0.75;
    else dy = row < rows / 2 ? -H * 0.9 : H * 0.9;
    const p = i === 11 ? 1 : uiS(t - cb(0) - i * 0.11, 150);
    let x = R.x + dx * (1 - p), y = R.y + dy * (1 - p), w = R.w, h = R.h;
    const c = heavyS(t - cb(5) - (Math.abs(col - (cols - 1) / 2) + Math.abs(row - (rows - 1) / 2)) * 0.035, 75);
    x = lerp(x, L.markX - MARK.w / 2, c); y = lerp(y, L.markY - MARK.h / 2, c);
    w = lerp(w, MARK.w, c); h = lerp(h, MARK.h, c);
    if (c > 0.985) return;
    ctx.save(); rr(x, y, w, h, lerp(14, 10, c)); ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.fillStyle = rgba(C.white, c); ctx.fillRect(x, y, w, h);   // tiles whiten as they merge into the mark
    ctx.restore();
  });
  const m = uiS(t - cb(5.6), 220);
  if (m > 0.001) drawMark(L.markX, L.markY, MARK.w, MARK.h, MARK.skew * m, 10, 0, C.white);
  drawLockupText(L, typeS(t - cb(6), 160), typeS(t - cb(6.8), 200), typeS(t - cb(8), 200));
}
