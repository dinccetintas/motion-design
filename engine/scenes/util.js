// Shared helpers for scene modules.
import { clamp } from '../core.js';

/** Colors + accent treatment that stay legible on the scene's ground. */
export function palette(g, S) {
  const G = g.style.grounds, gr = G[S.ground] || G.dark;
  let accentStyle = g.style.accentStyle;
  if (S.ground === 'accent' && accentStyle === 'color') accentStyle = 'underline';
  return {
    ground: S.ground, bg: gr.bg, ink: gr.ink, accent: gr.accent, accentStyle,
    onAccent: S.ground === 'accent' ? gr.bg : G.accent.ink,
    // A second surface tone for panels/cards on this ground.
    surface: S.ground === 'dark' ? G.light.bg : S.ground === 'light' ? G.dark.bg : G.dark.bg,
    onSurface: S.ground === 'dark' ? G.light.ink : G.dark.ink,
    hilite: S.ground === 'accent' ? gr.ink : G.accent.bg,
  };
}

/** Options for drawText from a palette. */
export const textOpts = (P, t, extra = {}) => ({ t, ink: P.ink, accent: P.accent, bg: P.bg, onAccent: P.onAccent, accentStyle: P.accentStyle, ...extra });

/** Split the safe area vertically: returns [top, bottom] boxes at fraction f. */
export function splitV(box, f, gap = 0) {
  const h1 = box.h * f - gap / 2;
  return [{ x: box.x, y: box.y, w: box.w, h: h1 }, { x: box.x, y: box.y + h1 + gap, w: box.w, h: box.h - h1 - gap }];
}

/** Exit time (local seconds) when the next cut is hard, else null. */
export const exitAt = (S) => S.exitAt ?? null;

/** Even beat slots: when should item k of n land, packed into the first `frac` of the scene. */
export function slots(S, n, frac = 0.62, first = 0.0) {
  const beat = S.beat, avail = S.dur * frac - first;
  const step = n <= 1 ? 0 : Math.max(beat / 4, Math.floor((avail / (n - 1)) / (beat / 4)) * (beat / 4));
  return Array.from({ length: n }, (_, k) => first + Math.min(k * Math.min(step, beat), avail));
}

export const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
export const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
export { clamp };

/** Mean color of an image's opaque pixels, and whether it is a full tile (an app icon).
 *  Computed once from a 24px reduction and cached on the image, so frames stay pure. */
export function imageTone(img) {
  if (img._tone) return img._tone;
  const c = document.createElement('canvas'); c.width = c.height = 24;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, 24, 24);
  const d = x.getImageData(0, 0, 24, 24).data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  const hex = (v) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, '0');
  const tile = [1, 22, 553, 574].every((k) => d[k * 4 + 3] > 200);
  return (img._tone = { color: `#${hex(r)}${hex(gg)}${hex(b)}`, tile });
}
