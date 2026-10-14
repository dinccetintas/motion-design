// showcase/main.js — entry point: window.seek(t) paints frame t; window.ready resolves once fonts
// and every plate frame are decoded.

const SECTIONS = [[SEC.ink, drawInk], [SEC.clay, drawClay], [SEC.fire, drawFire],
  [SEC.heat, drawHeat], [SEC.paint, drawPaint], [SEC.desk, drawDesk]];

window.seek = (t) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.setLineDash([]);
  ctx.shadowColor = 'transparent';
  let fn = null;
  for (const [s, f] of SECTIONS) if (t >= s) fn = f;
  if (fn && t < SEC.end) fn(t); else bg(C.black);
};

window.ready = (async () => {
  await Promise.all(['800 40px "Barlow Condensed"', '500 40px "Space Grotesk"'].map((f) => document.fonts.load(f)));
  await loadPlates(['ink_bloom', 'ink_macro', 'clay_hands', 'clay_macro', 'fire_wool', 'fire_skier',
    'thermal_runner', 'thermal_hands', 'paint_city', 'paint_sky', 'desk']);
  window.seek(0);
})();
