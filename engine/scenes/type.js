// Typographic scenes: the backbone of motion design.
import { sp, ew, ease, bump, clamp, alpha, noise1 } from '../core.js';
import { drawText } from '../kinetic.js';
import { palette, textOpts, splitV, exitAt, slots, arr } from './util.js';

const withPunch = (g, cx, cy, k, fn) => {
  const ctx = g.ctx; g.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); fn(); g.restore();
};

export const title = {
  beats: 4,
  describe: 'HOOK. 1-6 huge words slam in on eighth notes, one *accent* word, optional sub line. Best as scene 1.',
  props: { text: '1-6 words, mark one accent word like *this*', sub: 'optional, <= 8 words' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe;
    const [top, bot] = p.sub ? splitV(box, 0.8, g.u * 5) : [box, null];
    const L = g.fit(p.text || 'Untitled', top, { role: 'display', maxLines: 4 });
    const oy = top.y + (top.h - L.h) * (g.portrait ? 0.42 : 0.5), ox = top.x;
    const st = Math.min(S.beat / 2, 0.3);
    const accentIdx = L.lines.flatMap((l) => l.words).findIndex((w) => w.accent);
    const ta = -0.1 + Math.max(0, accentIdx) * st;
    const k = 1 + bump(lt, ta + 0.05, 0.03);
    withPunch(g, ox + L.w / 2, oy + L.h / 2, k, () => {
      const land = drawText(g, L, ox, oy, textOpts(P, lt, { start: -0.1, stagger: st, mode: 'rise', exitAt: exitAt(S) }));
      // Accent rule shoots in under the block once the last word lands.
      const rp = sp(lt - (land - 0.15), 'snap') * (1 - sp(lt - (exitAt(S) ?? 1e9), 'snap'));
      if (rp > 0.001) g.rect(ox, oy + L.h + L.size * 0.16, L.w * rp, Math.max(6, L.size * 0.09), P.ground === 'accent' ? P.ink : P.hilite);
      if (bot && p.sub) {
        const Ls = g.fit(p.sub, { ...bot, h: Math.min(bot.h, g.u * 14) }, { role: 'text', maxLines: 2, maxSize: g.u * 6 });
        drawText(g, Ls, bot.x, bot.y + g.u * 2, textOpts(P, lt, { start: land, stagger: 0.04, mode: 'rise', exitAt: exitAt(S) }));
      }
    });
  },
  cues(p, S) {
    const n = Math.min(6, String(p.text || '').split(/\s+/).length), st = Math.min(S.beat / 2, 0.3);
    return Array.from({ length: n }, (_, i) => ({ t: Math.max(0, -0.1 + i * st + 0.04), sfx: i === n - 1 ? 'thump' : 'tick', gain: i === n - 1 ? 0.8 : 0.45 }));
  },
};

export const statement = {
  beats: 6,
  describe: 'A sentence (6-16 words) builds word by word on the beat. One *accent* word. mode: build | karaoke.',
  props: { text: 'sentence, 6-16 words, one *accent* word', mode: 'build | karaoke' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe;
    const L = g.fit(p.text || '', { ...box, h: box.h * 0.86 }, { role: 'display', maxLines: g.portrait ? 7 : 4, maxSize: g.u * (g.portrait ? 24 : 15) });
    const n = L.lines.reduce((a, l) => a + l.words.length, 0);
    const st = clamp(Math.round((S.dur * 0.5 / n) / (S.beat / 4)) * (S.beat / 4), S.beat / 4, S.beat / 2);
    const oy = box.y + (box.h - L.h) * 0.45;
    if (p.mode === 'karaoke') {
      drawText(g, L, box.x, oy, textOpts(P, lt, { start: -1, stagger: 0, mode: 'none', dim: true, ink: P.ink }));
      // Lit layer: words switch on in sequence.
      drawText(g, L, box.x, oy, textOpts(P, lt, { start: 0, stagger: st, mode: 'none', exitAt: exitAt(S) }));
    } else {
      drawText(g, L, box.x, oy, textOpts(P, lt, { start: 0, stagger: st, mode: 'rise', exitAt: exitAt(S) }));
    }
  },
  cues: () => [],
};

export const stack = {
  beats: 6,
  describe: 'A list of 2-5 short items (1-4 words each) that stack in on successive beats with drawn rules. Good for features, steps, benefits.',
  props: { title: 'optional heading, <= 5 words', items: 'array of 2-5 strings, 1-4 words each; mark accent with *x*' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, items = arr(p.items).slice(0, 5);
    let area = box, tl = 0;
    if (p.title) {
      const [a, b] = splitV(box, g.portrait ? 0.2 : 0.24, g.u * 3);
      const Lt = g.fit(p.title, a, { role: 'text', maxLines: 2, maxSize: g.u * 7, weight: 600 });
      drawText(g, Lt, a.x, a.y + (a.h - Lt.h), textOpts(P, lt, { start: 0, stagger: 0.04, exitAt: exitAt(S) }));
      area = b; tl = S.beat * 0.5;
    }
    const n = Math.max(1, items.length), rowH = Math.min(area.h / n, g.u * (g.portrait ? 40 : 22));
    const idxW = g.u * 9;
    // Same type size for every row: the smallest fit wins.
    const fits = items.map((it) => g.fit(it, { x: 0, y: 0, w: area.w - idxW, h: rowH * 0.7 }, { role: 'display', maxLines: 2 }));
    const size = Math.min(...fits.map((f) => f.size));
    const at = slots(S, n, 0.6, tl);
    const y0 = area.y + (area.h - rowH * n) / 2;
    items.forEach((it, k) => {
      const L = g.fit(it, { x: 0, y: 0, w: area.w - idxW, h: rowH * 0.7 }, { role: 'display', maxLines: 2, maxSize: size, minSize: size });
      const ry = y0 + k * rowH, t0 = at[k];
      const rp = ew(lt, t0, 0.5, ease.outExpo) * (1 - ew(lt, (exitAt(S) ?? 1e9) + k * 0.03, 0.3, ease.inExpo));
      g.rect(area.x, ry, area.w * rp, Math.max(2, g.u * 0.35), alpha(P.ink, 0.5));
      g.font(g.u * 3.6, 'mono');
      if (rp > 0.3) g.text(String(k + 1).padStart(2, '0'), area.x, ry + g.u * 5, P.ground === 'accent' ? P.ink : P.accent);
      drawText(g, L, area.x + idxW, ry + (rowH - L.h) / 2, textOpts(P, lt, { start: t0 + 0.04, stagger: 0.05, mode: 'rise', exitAt: exitAt(S) }));
    });
  },
  cues(p, S) { const n = arr(p.items).length; return slots(S, n, 0.6, p.title ? S.beat * 0.5 : 0).map((t) => ({ t: t + 0.05, sfx: 'pop', gain: 0.5 })); },
};

export const swap = {
  beats: 8,
  describe: 'A fixed line plus a slot word that rolls to a new word every beat ("Built for *speed* / *teams* / *scale*"). 2-5 slot words.',
  props: { prefix: 'fixed line, 1-5 words', words: 'array of 2-5 single words or short phrases' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, words = arr(p.words).slice(0, 5);
    // The slot sets the scale: the widest word fills the width on one line.
    const fits = words.map((w) => g.fit(w, { x: 0, y: 0, w: box.w, h: box.h * 0.3 }, { role: 'display', maxLines: 1 }));
    const size = Math.min(g.u * (g.portrait ? 34 : 26), ...fits.map((f) => f.size));
    const Lp = g.fit(p.prefix || '', { ...box, h: box.h * 0.45 }, { role: 'display', maxLines: 3, maxSize: size });
    const capS = size * (g.style.fonts.display.capHeight ?? 0.72);
    const blockH = Lp.h + size * 0.35 + capS;
    const oy = box.y + (box.h - blockH) * 0.45;
    drawText(g, Lp, box.x, oy, textOpts(P, lt, { start: 0, stagger: 0.06, exitAt: exitAt(S) }));
    const { step, start } = swapTiming(S, words.length);
    const sy = oy + Lp.h + size * 0.35 + capS;
    g.save(); g.clipRect(box.x - g.u * 2, sy - capS - size * 0.1, box.w + g.u * 4, capS + size * 0.2);
    let uw = 0;
    words.forEach((w, k) => {
      const tk = start + k * step, last = k === words.length - 1;
      const pin = sp(lt - tk, 'snap'), pout = last ? sp(lt - (exitAt(S) ?? 1e9), 'snap') : sp(lt - (tk + step), 'snap');
      if (pin <= 0.001 || pout >= 0.999) return;
      g.font(size, 'display');
      uw += g.measure(w) * (pin - pout);
      const y = sy + (1 - pin) * size * 1.1 - pout * size * 1.1;
      g.text(w, box.x, y, P.ground === 'accent' ? P.ink : P.accent);
    });
    g.restore();
    if (uw > 1) g.rect(box.x, sy + size * 0.14, uw, Math.max(6, size * 0.06), P.ink);
  },
  cues(p, S) {
    const n = arr(p.words).length, { step, start } = swapTiming(S, n);
    return Array.from({ length: n }, (_, k) => ({ t: start + k * step, sfx: 'click', gain: 0.6 }));
  },
};
/** Slot changes land on whole beats. */
function swapTiming(S, n) {
  const start = S.beat * 0.5;
  const step = Math.max(1, Math.floor((S.dur - S.beat * 1.5) / Math.max(1, n) / S.beat)) * S.beat;
  return { step, start };
}

export const marquee = {
  beats: 6,
  describe: 'Two to four rows of huge repeating words drifting in opposite directions. Energy, themes, values. Middle row outlined.',
  props: { words: 'array of 2-4 single words' },
  draw(g, p, lt, S) {
    const P = palette(g, S), words = arr(p.words).slice(0, 4), n = Math.max(1, words.length);
    const rowH = g.H / (n + (g.portrait ? 1.6 : 0.8)), size = rowH * 0.95;
    const y0 = (g.H - rowH * n) / 2;
    words.forEach((w, i) => {
      g.font(size, 'display');
      const dir = i % 2 ? -1 : 1, gap = size * 0.5, unit = g.measure(w) + gap;
      const enter = (1 - sp(lt - i * S.beat * 0.25, 'snap')) * g.W * 1.2 * dir;
      const drift = -dir * size * 0.9 * lt;
      const ex = sp(lt - ((exitAt(S) ?? 1e9) + i * 0.04), 'snap') * g.W * 1.3 * -dir;
      const base = y0 + (i + 0.82) * rowH;
      // Drift wraps; the entrance and exit move the whole row so it visibly arrives.
      let x = ((drift % unit) + unit) % unit - unit + enter + ex;
      if (x > 0) x -= Math.ceil(x / unit) * unit * (enter < 0 || ex < 0 ? 1 : 0);
      const outline = i === 1 || (n === 1);
      for (; x < g.W + unit; x += unit) {
        if (outline) g.text(w, x, base, P.ground === 'accent' ? P.ink : P.accent, { stroke: Math.max(2, size * 0.022) });
        else g.text(w, x, base, P.ink);
        g.circle(x + unit - gap / 2, base - size * 0.36, size * 0.07, P.ink);
      }
    });
  },
  cues(p, S) { return arr(p.words).map((_, i) => ({ t: i * S.beat * 0.25, sfx: 'whoosh', gain: 0.35, dur: 0.3 })); },
};

export const quote = {
  beats: 8,
  describe: 'A pull quote (8-30 words) with attribution. Words rise in; giant quote mark lands first.',
  props: { text: 'the quote, 8-30 words, one *accent* phrase', author: 'name', role: 'optional title/company' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe;
    const markSize = g.u * (g.portrait ? 40 : 34);
    const mp = sp(lt, g.style.motion.obj);
    g.font(markSize * (0.6 + 0.4 * mp), 'display', { weight: 700, caps: false });
    g.ctx.globalAlpha = clamp(mp * 2);
    g.text('“', box.x - g.u, box.y + markSize * 0.62, P.ground === 'accent' ? P.ink : P.accent, { decor: true });
    g.ctx.globalAlpha = 1;
    const area = { x: box.x, y: box.y + markSize * 0.45, w: box.w, h: box.h - markSize * 0.45 - g.u * 16 };
    const L = g.fit(p.text || '', area, { role: 'display', maxLines: g.portrait ? 9 : 5, maxSize: g.u * (g.portrait ? 17 : 12), caps: false });
    const n = L.lines.reduce((a, l) => a + l.words.length, 0);
    const st = clamp(S.dur * 0.35 / n, 0.025, 0.09);
    const land = drawText(g, L, area.x, area.y, textOpts(P, lt, { start: S.beat * 0.5, stagger: st, mode: 'rise', exitAt: exitAt(S) }));
    const ay = area.y + L.h + g.u * 9;
    const rp = ew(lt, land, 0.6, ease.outExpo);
    g.rect(box.x, ay - g.u * 1.4, g.u * 8 * rp, Math.max(3, g.u * 0.5), P.ground === 'accent' ? P.ink : P.accent);
    if (p.author) {
      const La = g.fit(p.author + (p.role ? ' — ' + p.role : ''), { x: 0, y: 0, w: box.w - g.u * 11, h: g.u * 5 }, { role: 'text', maxLines: 1, weight: 600 });
      drawText(g, La, box.x + g.u * 11, ay - La.capH + g.u * 0.2 - g.u * 1.4, textOpts(P, lt, { start: land + 0.1, stagger: 0.03, mode: 'rise', exitAt: exitAt(S) }));
    }
  },
  cues: (p, S) => [{ t: 0.02, sfx: 'thump', gain: 0.6 }],
};

export const tunnel = {
  beats: 6,
  describe: 'Words fly out of depth toward the camera one per beat; the last one lands and holds. High energy, 3-6 single words.',
  props: { words: 'array of 3-6 single words; last one is the payoff' },
  draw(g, p, lt, S) {
    const P = palette(g, S), words = arr(p.words).slice(0, 6), n = words.length;
    const ctx = g.ctx, cx = g.W / 2, cy = g.H / 2;
    // Depth frames rushing outward give the sense of travel.
    for (let k = 0; k < 7; k++) {
      const z = ((k / 7 + lt * 0.55) % 1), s = Math.pow(z, 2.4) * 2.2;
      const w = g.W * s, h = g.H * s;
      ctx.strokeStyle = alpha(P.ink, 0.12 * clamp(z * 3) * (1 - clamp((z - 0.8) * 5)));
      ctx.lineWidth = g.u * 0.25 + s * g.u * 0.5;
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    }
    const step = Math.max(S.beat / 2, (S.dur * 0.7) / Math.max(1, n));
    const finalBox = { x: g.safe.x, y: 0, w: g.safe.w, h: g.H * 0.3 };
    words.forEach((w, i) => {
      const ti = i * step, last = i === n - 1;
      const L = g.fit(w, finalBox, { role: 'display', maxLines: 1 });
      // depth parameter: 0 = far, 1 = at screen plane, >1 = behind camera
      const d = (lt - ti + step * 0.9) / (step * 0.9);
      let s;
      if (d <= 0) return;
      if (last) s = 0.04 + 0.96 * sp(lt - ti, 'heavy');
      else s = d < 1 ? Math.pow(d, 3) : Math.pow(d, 5);
      const a = last ? clamp(d * 3) : clamp(d * 3) * (1 - clamp((s - 2.2) / 2));
      if (a <= 0.01 || s > 9) return;
      g.save();
      ctx.globalAlpha = a;
      ctx.translate(cx, cy); ctx.scale(s, s);
      g.font(L.size, 'display');
      const ww = g.measure(w);
      const col = last ? (P.ground === 'accent' ? P.ink : P.accent) : P.ink;
      g.text(w, -ww / 2, L.capH / 2, col, s > 1.3 ? { decor: true } : {});
      g.restore();
    });
  },
  cues(p, S) {
    const n = arr(p.words).length, step = Math.max(S.beat / 2, (S.dur * 0.7) / Math.max(1, n));
    return Array.from({ length: n }, (_, i) => ({ t: i * step, sfx: i === n - 1 ? 'thump' : 'whoosh', gain: 0.5, dur: 0.35 }));
  },
};
