// Entry point: window.seek(t) paints frame t; window.ready resolves once fonts, 3D scenes
// and closing-grid thumbnails exist.

const SECTIONS = [
  [SEC.open, () => drawOpen], [SEC.hal, () => drawHalcyon], [SEC.vec, () => window.drawVector],
  [SEC.mer, () => window.drawMeridian], [SEC.aura, () => window.drawAura], [SEC.close, () => window.drawClose],
];

window.seek = (t) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let fn = null;
  for (const [s, get] of SECTIONS) if (t >= s) fn = get();
  if (fn) fn(t); else bg('#222');
};

window.ready = (async () => {
  const faces = ['300 40px Fraunces', '600 40px Fraunces', '500 40px "Space Grotesk"', '700 40px "Space Grotesk"',
    '500 40px "Barlow Condensed"', '800 40px "Barlow Condensed"', '200 40px Manrope', '500 40px Manrope'];
  await Promise.all(faces.map((f) => document.fonts.load(f)));
  if (window.initVector) initVector();
  if (window.initAura) initAura();
  if (window.initClose) initClose();
  window.seek(0);
})();
