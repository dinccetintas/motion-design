// Signature scenes: the kinetic devices people remember.
import { sp, ew, ease, clamp, alpha, lerp, hash, track, bump, TAU } from '../core.js';
import { drawText } from '../kinetic.js';
import { parseRich } from '../gfx.js';
import { palette, textOpts, splitV, exitAt, arr } from './util.js';

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** One split-flap tile flipping from `from` to `to` with progress f in [0,1]. */
function flapTile(g, x, y, w, h, from, to, f, ink, tile, seam) {
  const ctx = g.ctx, mid = y + h / 2, size = h * 0.74;
  g.rrect(x, y, w, h, Math.min(w, h) * 0.08, tile);
  g.font(size, 'display', { caps: true, tracking: 0 });
  const glyph = (ch, clipTop, scaleY) => {
    g.save();
    ctx.beginPath(); ctx.rect(x, clipTop ? y : mid, w, h / 2); ctx.clip();
    ctx.translate(0, mid); ctx.scale(1, scaleY); ctx.translate(0, -mid);
    const cw = g.measure(ch);
    g.text(ch, x + (w - cw) / 2, y + h / 2 + size * 0.36, ink, { decor: true });
    g.restore();
  };
  // Static halves: new top, old bottom (until the flap covers it).
  glyph(to, true, 1);
  glyph(f >= 1 ? to : from, false, 1);
  if (f < 1) {
    if (f < 0.5) { // old top half falls toward the seam
      g.save(); ctx.beginPath(); ctx.rect(x, y, w, h / 2); ctx.clip();
      ctx.translate(0, mid); ctx.scale(1, 1 - f * 2); ctx.translate(0, -mid);
      g.rrect(x, y, w, h / 2, 0, tile); g.restore();
      glyph(from, true, 1 - f * 2);
    } else {       // new bottom half unfolds from the seam
      g.save(); ctx.beginPath(); ctx.rect(x, mid, w, h / 2); ctx.clip();
      ctx.translate(0, mid); ctx.scale(1, f * 2 - 1); ctx.translate(0, -mid);
      g.rrect(x, mid, w, h / 2, 0, tile); g.restore();
      glyph(to, false, f * 2 - 1);
    }
  }
  g.rect(x, mid - Math.max(1, h * 0.012), w, Math.max(2, h * 0.024), seam);
}

/** Re-flow the message onto the board shape that gives the biggest tiles: a tall frame stacks
 *  words on more rows, a wide one keeps each line whole. Never splits a word. */
function flapLayout(g, src, box) {
  const gap = g.u * 0.9, maxLen = Math.max(4, ...src.map((l) => l.text.length));
  const longestWord = Math.max(3, ...src.flatMap((l) => l.text.split(' ').map((w) => w.length)));
  let best = null;
  for (let c = longestWord; c <= maxLen; c++) {
    const lines = [];
    for (const l of src) {
      let row = '';
      for (const w of l.text.split(' ').filter(Boolean)) {
        if (row && (row + ' ' + w).length > c) { lines.push({ text: row, accent: l.accent }); row = w; } else row = row ? row + ' ' + w : w;
      }
      lines.push({ text: row, accent: l.accent });
    }
    if (lines.length > 6) continue;
    // No orphans: a broken line never leaves a one- or two-letter row ("A", "01").
    if (lines.length > src.length && lines.some((l) => l.text.length < 3)) continue;
    const cols = Math.max(4, c), rows = lines.length;
    const tw = Math.min((box.w - gap * (cols - 1)) / cols, ((box.h * 0.78 - (rows - 1) * gap * 2.2) / rows) / 1.45);
    // Bigger tiles win, but every extra break costs: the board should still read as the lines written.
    const score = tw * Math.pow(0.88, rows - src.length);
    if (!best || score > best.score) best = { lines, cols, tw, gap, score };
  }
  return best;
}

export const flap = {
  beats: 6,
  describe: 'Split-flap departure board: every tile flips through letters and lands on the message. Dates, times, launches, places, codes. 1-3 short lines.',
  props: { lines: 'array of 1-3 lines, <= 12 characters each; wrap one line in *asterisks* for the accent color' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe;
    const src = arr(p.lines).slice(0, 3).map((l) => ({ text: String(l).replace(/\*/g, '').toUpperCase().slice(0, 14), accent: /\*/.test(l) }));
    const { lines, cols, tw, gap } = flapLayout(g, src, box);
    const rows = lines.length || 1, th = tw * 1.45;
    const totalW = cols * tw + (cols - 1) * gap, totalH = rows * th + (rows - 1) * gap * 2.2;
    const x0 = box.x + (box.w - totalW) / 2, y0 = box.y + (box.h - totalH) * 0.45;
    const tile = S.ground === 'dark' ? '#1C1C1E' : '#141416', seam = S.ground === 'dark' ? '#0A0A0A' : '#050505';
    const step = 0.055;
    lines.forEach((ln, r) => {
      const ink = ln.accent ? g.style.grounds.accent.bg : '#F3F1EA';
      for (let c = 0; c < cols; c++) {
        const target = ln.text[c] || ' ';
        const seed = r * 97 + c * 13 + (S.seed || 1);
        const flips = 6 + Math.floor(hash(seed, 3) * 9);
        const t0 = r * 0.18 + c * 0.04;   // flipping from frame 0: the board is the hook
        const k = Math.floor((lt - t0) / step);
        const x = x0 + c * (tw + gap), y = y0 + r * (th + gap * 2.2);
        if (lt < t0) { g.rrect(x, y, tw, th, tw * 0.08, tile); g.rect(x, y + th / 2 - 1, tw, 2, seam); continue; }
        const at = (i) => (i >= flips ? target : FLAP_CHARS[Math.floor(hash(seed + i * 7, 5) * FLAP_CHARS.length)]);
        if (k >= flips) { flapTile(g, x, y, tw, th, target, target, 1, ink, tile, seam); continue; }
        const f = ((lt - t0) - k * step) / step;
        flapTile(g, x, y, tw, th, at(k - 1 < 0 ? 0 : k - 1), at(k), ease.outCubic(f), ink, tile, seam);
      }
    });
    // Tiles draw decor glyphs; the validator reads the settled message, one record per line.
    if (g.probe) lines.forEach((ln, r) => {
      const n = ln.text.trimEnd().length; if (!n) return;
      g.font(th * 0.74, 'display');
      g.probe.push({ text: ln.text.trim(), x0, y0: y0 + r * (th + gap * 2.2), x1: x0 + n * (tw + gap) - gap, y1: y0 + r * (th + gap * 2.2) + th, size: th * 0.74, color: ln.accent ? g.style.grounds.accent.bg : '#F3F1EA', stroke: false, clip: null, contrast: 12 });
    });
  },
  cues(p, S) {
    const out = [], rows = Math.min(6, arr(p.lines).reduce((a, l) => a + Math.max(1, Math.ceil(String(l).replace(/\*/g, '').length / 8)), 0));
    for (let r = 0; r < rows; r++) for (let k = 0; k < 10; k++) out.push({ t: r * 0.18 + k * 0.055, sfx: 'key', gain: 0.3 });
    out.push({ t: rows * 0.18 + 0.9, sfx: 'click', gain: 0.6 });
    return out;
  },
};

export const highlight = {
  beats: 8,
  describe: 'A paragraph from the source (15-35 words) appears, then a marker sweeps over the key phrase and the rest dims. For articles and quotes from documents.',
  props: { text: 'the paragraph, 15-35 words', mark: 'the exact phrase inside text to highlight (2-8 words)', source: 'optional source line' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, ctx = g.ctx;
    const text = String(p.text || ''), mark = String(p.mark || '').toLowerCase().replace(/[^\w\s]/g, '');
    // Tag words that belong to the marked phrase.
    const words = parseRich(text.replace(/\*/g, ''));
    const plainWords = words.map((w) => w.text.toLowerCase().replace(/[^\w]/g, ''));
    const mw = mark.split(/\s+/).filter(Boolean);
    let ms = -1;
    // Words joined by dashes ("economy—including") still match at the phrase's edges.
    const eq = (a, m, j) => a === m || (j === 0 && a.endsWith(m)) || (j === mw.length - 1 && a.startsWith(m));
    for (let i = 0; i + mw.length <= plainWords.length && mw.length; i++) if (mw.every((m, j) => eq(plainWords[i + j], m, j))) { ms = i; break; }
    words.forEach((w, i) => { w.accent = ms >= 0 && i >= ms && i < ms + mw.length; });
    const area = { ...box, h: box.h * (p.source ? 0.82 : 0.9) };
    const L = g.fit(words, area, { role: 'text', maxLines: g.portrait ? 13 : 9, maxSize: g.u * (g.portrait ? 10.5 : 8.5), lineHeight: 1.28, weight: 500 });
    const oy = box.y + (area.h - L.h) * 0.5;
    const sweep0 = Math.min(S.dur * 0.42, S.beat * 4), dim = ew(lt, sweep0 + 0.6, 0.6, ease.outCubic);
    const hl = g.style.grounds.accent.bg, onHl = g.style.grounds.accent.ink;
    // Marker strokes behind the marked words, line by line.
    let order = 0;
    for (const line of L.lines) {
      const seg = line.words.filter((w) => w.accent);
      if (!seg.length) continue;
      const x1 = seg[0].x - L.size * 0.12, x2 = seg[seg.length - 1].x + seg[seg.length - 1].w + L.size * 0.12;
      const sp1 = ew(lt, sweep0 + order * 0.28, 0.42, ease.inOutCubic);
      order++;
      if (sp1 <= 0) continue;
      const y = oy + line.y - L.capH - L.size * 0.2, h = L.capH + L.size * 0.42;
      ctx.save(); ctx.translate(box.x, 0);
      g.rrect(x1, y, (x2 - x1) * sp1, h, L.size * 0.08, S.ground === 'accent' ? P.ink : hl);
      ctx.restore();
    }
    const n = L.lines.reduce((a, l) => a + l.words.length, 0);
    // Words: unmarked ones dim once the sweep lands; marked ones switch ink under the marker.
    for (const line of L.lines) for (const w of line.words) {
      const idx = L.lines.flatMap((l) => l.words).indexOf(w);
      const t0 = 0.05 + idx * Math.min(0.045, (sweep0 - 0.3) / n);
      const pr = sp(lt - t0, 'type');
      if (pr <= 0.01) continue;
      g.font(L.size, 'text', { weight: 500 });   // the layout was measured at 500; the marker carries the emphasis
      ctx.globalAlpha = clamp(pr * 1.5) * (w.accent ? 1 : 1 - 0.55 * dim);
      const col = w.accent && order > 0 && lt > sweep0 + 0.2 ? (S.ground === 'accent' ? P.bg : onHl) : P.ink;
      g.text(w.text, box.x + w.x, oy + line.y + (1 - pr) * L.size * 0.5, col);
      ctx.globalAlpha = 1;
    }
    if (p.source) {
      const Ls = g.fit(p.source, { x: 0, y: 0, w: box.w, h: g.u * 5 }, { role: 'mono', maxLines: 1, maxSize: g.u * 4.4 });
      drawText(g, Ls, box.x, oy + L.h + g.u * 7, textOpts(P, lt, { start: sweep0 + 0.4, stagger: 0.02, ink: alpha(P.ink, 0.7), exitAt: exitAt(S) }));
    }
  },
  cues(p, S) { const s0 = Math.min(S.dur * 0.42, S.beat * 4); return [{ t: s0, sfx: 'swish', gain: 0.5 }, { t: s0 + 0.5, sfx: 'pop', gain: 0.35 }]; },
};

export const assemble = {
  beats: 6,
  describe: 'Scattered letters fly in from across the frame and lock into one word or short name. A big reveal moment: a product name, a verdict, a payoff.',
  props: { text: '1-3 words; mark one with *asterisks* for the accent color', sub: 'optional line under it, <= 8 words' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, ctx = g.ctx;
    const [top, bot] = p.sub ? splitV(box, 0.72, g.u * 4) : [box, null];
    const L = g.fit(p.text || '', top, { role: 'display', maxLines: 3 });
    const oy = top.y + (top.h - L.h) * 0.5;
    let k = 0, land = 0;
    for (const line of L.lines) for (const w of line.words) {
      g.font(L.size, 'display');
      let x = box.x + w.x;
      for (const ch of g.cased(w.text)) {
        const cw = g.measure(ch), seed = k * 31 + (S.seed || 1);
        const t0 = 0.08 + k * 0.035 + hash(seed, 9) * 0.12;
        land = Math.max(land, t0 + 0.5);
        const pr = sp(lt - t0, g.style.motion.obj === 'bounce' ? 'bounce' : 'heavy');
        const sx = (hash(seed, 1) - 0.5) * g.W * 1.6, sy = (hash(seed, 2) - 0.5) * g.H * 1.4;
        const rot = (hash(seed, 3) - 0.5) * 2.4, sc = 0.3 + hash(seed, 4) * 2.2;
        const tx = x + sx * (1 - pr), ty = oy + line.y + sy * (1 - pr);
        ctx.save();
        ctx.globalAlpha = clamp(pr * 3);
        ctx.translate(tx + cw / 2, ty - L.capH / 2); ctx.rotate(rot * (1 - pr)); const s = lerp(sc, 1, pr); ctx.scale(s, s); ctx.translate(-cw / 2, L.capH / 2);
        g.text(ch, 0, 0, w.accent ? (S.ground === 'accent' ? P.ink : P.accent) : P.ink, pr < 0.95 ? { decor: true } : {});
        ctx.restore();
        x += cw; k++;
      }
      x += g.measure(' ');
    }
    const kk = 1 + bump(lt, land - 0.2, 0.02);
    if (bot && p.sub) {
      const Ls = g.fit(p.sub, { ...bot, h: Math.min(bot.h, g.u * 14) }, { role: 'text', maxLines: 2, maxSize: g.u * 6.5 });
      ctx.save(); ctx.translate(g.W / 2, 0); ctx.scale(kk, 1); ctx.translate(-g.W / 2, 0);
      drawText(g, Ls, bot.x, bot.y, textOpts(P, lt, { start: land, stagger: 0.04, exitAt: exitAt(S) }));
      ctx.restore();
    }
  },
  cues(p, S) { const n = String(p.text || '').replace(/[\s*]/g, '').length; return [{ t: 0.05, sfx: 'whoosh', gain: 0.4, dur: 0.5 }, { t: 0.08 + n * 0.035 + 0.45, sfx: 'thump', gain: 0.75 }]; },
};

export const device = {
  beats: 8,
  describe: 'A phone showing the real mobile site or app: it rises in, the screen scrolls on the beat, a thumb tap lands. Needs props.image (a tall mobile screenshot asset).',
  props: { image: 'asset key of a mobile screenshot', title: 'optional headline, <= 6 words', focus: '[x, y] 0-1 point to tap' },
  draw(g, p, lt, S) {
    const P = palette(g, S), ctx = g.ctx, b = S.beat, box = g.safe;
    const img = S.assets?.[p.image];
    let phoneBox, titleBox;
    if (g.portrait) { const [a, c] = splitV(box, p.title ? 0.2 : 0, g.u * 3); titleBox = a; phoneBox = c; }
    else { titleBox = { x: box.x, y: box.y, w: box.w * 0.48, h: box.h }; phoneBox = { x: box.x + box.w * 0.55, y: box.y - g.u * 3, w: box.w * 0.42, h: box.h + g.u * 6 }; }
    if (p.title) {
      const L = g.fit(p.title, titleBox, { role: 'display', maxLines: g.portrait ? 2 : 4, maxSize: g.u * (g.portrait ? 12 : 13) });
      drawText(g, L, titleBox.x, g.portrait ? titleBox.y + titleBox.h - L.h : titleBox.y + (titleBox.h - L.h) / 2, textOpts(P, lt, { start: 0, stagger: 0.06, exitAt: exitAt(S) }));
    }
    const ph = Math.min(phoneBox.h, phoneBox.w * 2.05), pw = ph / 2.05;
    const px = phoneBox.x + (phoneBox.w - pw) / 2, py = phoneBox.y + (phoneBox.h - ph) / 2;
    const enter = sp(lt - 0.05, g.style.motion.obj), ex = sp(lt - (exitAt(S) ?? 1e9), 'snap');
    const bez = pw * 0.045, r = pw * 0.16, sx = px + bez, sy = py + bez, sw = pw - bez * 2, sh = ph - bez * 2;
    const ih = img ? img.height * (sw / img.width) : sh * 2;
    const maxScroll = Math.max(0, ih - sh);
    const scroll = Math.min(maxScroll, track(lt, [[0, 0], [b * 2, maxScroll * 0.28], [b * 4, maxScroll * 0.5], [b * 6, maxScroll * 0.62]], 'soft'));
    ctx.save();
    ctx.translate(0, (1 - enter) * g.H * 0.8 + ex * g.H);
    ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate((1 - enter) * 0.12); ctx.translate(-(px + pw / 2), -(py + ph / 2));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = g.u * 7; ctx.shadowOffsetY = g.u * 3;
    g.rrect(px, py, pw, ph, r, '#0E0E10'); ctx.restore();
    g.rrect(px + 1, py + 1, pw - 2, ph - 2, r, '#1d1d21');
    ctx.save(); ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, r * 0.8); ctx.clip();
    if (img) ctx.drawImage(img, sx, sy - scroll, sw, ih); else g.rect(sx, sy, sw, sh, '#f4f4f4');
    // The island
    g.rrect(sx + sw / 2 - sw * 0.15, sy + sw * 0.035, sw * 0.3, sw * 0.085, sw * 0.05, '#0A0A0A');
    // Tap on the beat
    const tap = b * 5;
    const focus = arr(p.focus).length === 2 ? p.focus.map(Number) : [0.5, 0.45];
    if (lt > tap - 0.3) {
      const fx = sx + focus[0] * sw, fy = sy + focus[1] * sh, rp = clamp((lt - tap) / 0.55);
      const pre = clamp((lt - (tap - 0.3)) / 0.3);
      g.circle(fx, fy, sw * 0.07 * (1 - 0.25 * bump(lt, tap, 1)) * pre, 'rgba(255,255,255,0.55)');
      if (lt > tap) { ctx.beginPath(); ctx.arc(fx, fy, sw * (0.07 + rp * 0.18), 0, TAU); ctx.strokeStyle = alpha(g.style.grounds.accent.bg, 1 - rp); ctx.lineWidth = sw * 0.012; ctx.stroke(); }
    }
    ctx.restore();
    ctx.restore();
  },
  cues(p, S) { const b = S.beat; return [{ t: 0.05, sfx: 'whoosh', gain: 0.45, dur: 0.5 }, { t: b * 2, sfx: 'swish', gain: 0.3 }, { t: b * 4, sfx: 'swish', gain: 0.3 }, { t: b * 5, sfx: 'click', gain: 0.7 }]; },
};
