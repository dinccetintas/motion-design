// Kinetic typography: draws a fitted layout (Gfx.fit) with per-word motion.
// Each word's state is computed from local time alone.
import { clamp, sp, ew, ease, alpha } from './core.js';

/**
 * Draw a fitted text layout at (ox, oy) = top-left of its box.
 * o: { t, start, stagger, mode: rise|drop|slide|scale|type|none, spring, ink, accent,
 *      accentStyle, exitAt, exitStagger, bg (ground color), lineStagger, dim }
 * Returns the time the last word lands, so scenes can chain beats off it.
 */
export function drawText(g, L, ox, oy, o) {
  const ctx = g.ctx, t = o.t;
  const mode = o.mode || 'rise', stagger = o.stagger ?? 0.06, start = o.start ?? 0;
  const springName = o.spring || g.style.motion.type;
  const aStyle = o.accentStyle || g.style.accentStyle;
  const fopts = { ...L.opts };
  let i = 0, lastLand = start;
  const total = L.lines.reduce((n, l) => n + l.words.length, 0);
  L.lines.forEach((line, li) => {
    const lineTop = oy + line.y - L.capH - L.size * 0.12;
    const lineH = L.size * (L.role === 'display' ? 1.08 : 1.3);
    for (const w of line.words) {
      const idx = o.order === 'reverse' ? total - 1 - i : i;
      const t0 = start + idx * stagger + li * (o.lineStagger ?? 0);
      i++;
      lastLand = Math.max(lastLand, t0 + 0.35);
      let p = mode === 'none' ? (t >= t0 ? 1 : 0) : sp(t - t0, springName);
      const ex = o.exitAt != null ? sp(t - (o.exitAt + idx * (o.exitStagger ?? 0.03)), 'snap') : 0;
      if (p <= 0.001 && mode !== 'type') continue;
      const x = ox + w.x, y = oy + line.y;
      const accent = w.accent;
      const italic = accent && aStyle === 'italic';
      g.font(L.size, L.role, { ...fopts, italic });
      g.save();
      let dx = 0, dy = 0, sc = 1;
      if (mode === 'rise' || mode === 'drop') {
        g.clipRect(x - L.size * 0.2, lineTop, w.w + L.size * 0.6, lineH);
        dy = (1 - p) * lineH * (mode === 'rise' ? 1 : -1) - ex * lineH;
      } else if (mode === 'slide') {
        g.clipRect(ox - g.W, lineTop, g.W * 3, lineH);
        dx = (1 - p) * -L.size * 1.6; ctx.globalAlpha *= clamp(p * 2);
        dy = -ex * lineH;
      } else if (mode === 'scale') {
        sc = 0.6 + 0.4 * p; ctx.globalAlpha *= clamp(p * 1.6) * (1 - ex);
      } else {
        ctx.globalAlpha *= 1 - ex;
      }
      const ink = o.dim && !accent ? alpha(o.ink, 0.35) : o.ink;
      if (sc !== 1) { ctx.translate(x + w.w / 2, y - L.capH / 2); ctx.scale(sc, sc); ctx.translate(-(x + w.w / 2), -(y - L.capH / 2)); }
      const drawWord = (str, color, strokeW) => g.text(str, x + dx, y + dy, color, strokeW ? { stroke: strokeW } : {});
      let str = w.text;
      if (mode === 'type') {
        const n = Math.floor(clamp((t - t0) / Math.max(0.02, stagger)) * str.length);
        if (n <= 0) { g.restore(); continue; }
        str = str.slice(0, n);
      }
      if (accent && aStyle === 'box') {
        const bp = ew(t, t0 + 0.08, 0.4, ease.outExpo);
        const padX = L.size * 0.12, top = y - L.capH - L.size * 0.16, h = L.capH + L.size * 0.32;
        g.rect(x - padX + dx, top + dy, (w.w + padX * 2) * bp, h, o.accent);
        drawWord(str, o.onAccent || o.bg);
      } else if (accent && aStyle === 'underline') {
        drawWord(str, o.ink);
        const up = ew(t, t0 + 0.2, 0.45, ease.outExpo);
        g.rect(x + dx, y + dy + L.size * 0.1, w.w * up, Math.max(4, L.size * 0.075), o.accent);
      } else if (accent && aStyle === 'outline') {
        drawWord(str, o.accent, Math.max(2, L.size * 0.035));
      } else {
        drawWord(str, accent ? o.accent : ink);
      }
      g.restore();
    }
  });
  return lastLand;
}

/** Colors for a ground, ready for drawText. */
export function inks(g, ground) {
  const gr = g.style.grounds[ground] || g.style.grounds.dark;
  return { ink: gr.ink, accent: gr.accent, bg: gr.bg, onAccent: g.style.grounds.accent.ink };
}

/** Typewriter string helper: first n chars at cps from start. */
export const typed = (s, t, start = 0, cps = 30) => String(s).slice(0, Math.max(0, Math.floor((t - start) * cps)));

/** A small mono "data" line (labels, captions, URLs). */
export function monoLine(g, s, x, y, size, color, t, start, cps = 40) {
  g.font(size, 'mono', { weight: g.style.fonts.mono.weight });
  g.text(typed(s, t, start, cps), x, y, color);
}
