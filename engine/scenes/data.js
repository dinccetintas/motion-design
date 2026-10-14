// Data scenes: numbers that move. Counters roll like odometers, charts grow on the beat.
import { sp, ew, ease, clamp, alpha, lerp, bump } from '../core.js';
import { drawText } from '../kinetic.js';
import { palette, textOpts, splitV, exitAt, slots, arr, num } from './util.js';

const fmt = (v, dec) => {
  const s = Math.abs(v).toFixed(dec);
  const [i, f] = s.split('.');
  return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
};

/** Odometer: each digit column rolls continuously, low digits spin faster. */
function odometer(g, value, dec, x, y, size, color, o = {}) {
  const ctx = g.ctx;
  const target = fmt(o.final ?? value, dec);
  g.font(size, 'display', { caps: false });
  const dw = Math.max(...'0123456789'.split('').map((d) => g.measure(d)));
  const capH = size * (g.style.fonts.display.capHeight ?? 0.72);
  const scaled = Math.abs(value) * Math.pow(10, dec);
  let digitPos = 0, cx = x;
  const cells = [];
  // Lay out from the final string so the width never jumps while counting.
  for (let i = target.length - 1; i >= 0; i--) {
    const ch = target[i];
    if (/\d/.test(ch)) cells.unshift({ kind: 'd', pos: digitPos++ }); else cells.unshift({ kind: 'c', ch });
  }
  for (const c of cells) {
    if (c.kind === 'c') { g.text(c.ch, cx, y, color); cx += g.measure(c.ch); continue; }
    const v = scaled / Math.pow(10, c.pos);
    const d = v % 10, base = Math.floor(d), frac = d - base;
    // Only the fractional part of the lowest moving columns rolls; snap integers otherwise.
    // A column rolls only during the last unit step of the columns below it (199.x -> 200).
    const below = scaled % Math.pow(10, c.pos), lastStep = Math.pow(10, c.pos) - 1;
    const roll = c.pos === 0 ? frac : clamp(below - lastStep);
    const visible = v >= 1 || c.pos === 0 || c.pos < dec + 1;
    if (!visible && v < 0.001) { cx += dw; continue; }
    g.save(); g.clipRect(cx - size * 0.05, y - capH - size * 0.06, dw + size * 0.1, capH + size * 0.12);
    const step = capH + size * 0.3;
    for (const k of [0, 1]) {
      if (k === 1 && roll < 0.001) break;
      const dd = (base + k) % 10, ww = g.measure(String(dd));
      g.text(String(dd), cx + (dw - ww) / 2, y + (k - roll) * step, color);
    }
    g.restore();
    cx += dw;
  }
  return cx - x;
}

export const counter = {
  beats: 6,
  describe: 'One big number that rolls up like an odometer, with a label. Percent values also fill a bar.',
  props: { value: 'number', prefix: 'e.g. $', suffix: 'e.g. % or x or M', decimals: '0-2', label: 'what it means, <= 10 words, *accent* ok', from: 'optional start value' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe;
    const value = num(p.value, 100), dec = clamp(Math.round(num(p.decimals, 0)), 0, 2), from = num(p.from, 0);
    const pre = p.prefix || '', suf = p.suffix || '';
    // Size the number to fill the width at its final value; center number+bar+label as one block.
    const full = pre + fmt(value, dec) + suf;
    let Lf = g.fit(full, { ...box, h: box.h * (g.portrait ? 0.34 : 0.5) }, { role: 'display', maxLines: 1, caps: false });
    // Odometer cells are as wide as the widest digit: refit on that true width.
    g.font(Lf.size, 'display', { caps: false });
    const cellW = Math.max(...'0123456789'.split('').map((d) => g.measure(d)));
    const trueW = g.measure(pre) + g.measure(suf) + [...fmt(value, dec)].reduce((a, ch) => a + (/\d/.test(ch) ? cellW : g.measure(ch)), 0);
    if (trueW > box.w) Lf = g.fit(full, { ...box, h: box.h }, { role: 'display', maxLines: 1, caps: false, maxSize: Lf.size * box.w / trueW * 0.98 });
    const size = Lf.size;
    const Lb = p.label ? g.fit(p.label, { x: 0, y: 0, w: box.w, h: box.h * (g.portrait ? 0.3 : 0.25) }, { role: 'display', maxLines: 3, maxSize: g.u * (g.portrait ? 13 : 12) }) : null;
    const blockH = Lf.capH + g.u * 12 + (Lb ? Lb.h : 0);
    const top = { x: box.x, y: box.y + (box.h - blockH) * 0.46, w: box.w, h: Lf.capH + g.u * 2 };
    const bot = { x: box.x, y: top.y + top.h + g.u * 4, w: box.w, h: Lb ? Lb.h + g.u * 8 : 0 };
    const t0 = S.beat * 0.25, dur = Math.min(S.dur * 0.55, S.beat * 4);
    const pr = ease.outQuart(clamp((lt - t0) / dur));
    const v = lerp(from, value, pr);
    const y = top.y + top.h - g.u * 2;
    const enter = sp(lt, 'snap'), ex = sp(lt - (exitAt(S) ?? 1e9), 'snap');
    const k = 1 + bump(lt, t0 + dur, 0.04);
    const ctx = g.ctx;
    g.save();
    g.clipRect(0, y - Lf.capH - size * 0.25, g.W, Lf.capH + size * 0.5);
    ctx.translate(box.x, y + (1 - enter) * size + ex * -size * 1.2);
    ctx.scale(k, k);
    const col = P.ground === 'accent' ? P.ink : P.ink;
    g.font(size, 'display', { caps: false });
    let x = 0;
    if (pre) { g.text(pre, 0, 0, col); x += g.measure(pre); }
    x += odometer(g, v, dec, x, 0, size, col, { final: value });
    if (suf) { g.font(size, 'display', { caps: false }); g.text(suf, x, 0, P.ground === 'accent' ? P.ink : P.accent); }
    g.restore();
    // Percent bar or a measured rule.
    const isPct = /%/.test(suf) && value <= 100;
    const by = y + g.u * 5, bw = box.w;
    const bp = ew(lt, t0, dur, ease.outQuart) * (1 - ew(lt, exitAt(S) ?? 1e9, 0.3, ease.inExpo));
    g.rect(box.x, by, bw * ew(lt, 0, 0.6, ease.outExpo) * (1 - (exitAt(S) != null ? ew(lt, exitAt(S), 0.3, ease.inExpo) : 0)), Math.max(3, g.u * 0.4), alpha(P.ink, 0.25));
    g.rect(box.x, by - g.u * 0.6, bw * (isPct ? (pr * value) / 100 : bp), Math.max(6, g.u * 1.6), P.ground === 'accent' ? P.ink : P.accent);
    if (Lb) drawText(g, Lb, bot.x, bot.y + g.u * 6, textOpts(P, lt, { start: S.beat, stagger: 0.05, mode: 'rise', exitAt: exitAt(S) }));
  },
  cues(p, S) {
    const t0 = S.beat * 0.25, dur = Math.min(S.dur * 0.55, S.beat * 4);
    const out = [{ t: 0.02, sfx: 'whoosh', gain: 0.35, dur: 0.3 }];
    for (let i = 0; i < 10; i++) out.push({ t: t0 + dur * (1 - Math.pow(1 - i / 10, 0.5)) * 0.9, sfx: 'tick', gain: 0.25 });
    out.push({ t: t0 + dur, sfx: 'thump', gain: 0.7 });
    return out;
  },
};

export const bars = {
  beats: 8,
  describe: 'Horizontal bar chart of 2-5 labeled values that grow on successive half-beats; the highlight bar is accent.',
  props: { title: 'optional, <= 7 words', items: 'array of {label, value}', unit: 'e.g. % or ms or x', highlight: 'index of the hero bar (default: max)' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, items = arr(p.items).slice(0, 5).map((it) => ({ label: String(it.label ?? ''), value: num(it.value, 0) }));
    let area = box;
    if (p.title) {
      const [a, b] = splitV(box, g.portrait ? 0.22 : 0.26, g.u * 4);
      const Lt = g.fit(p.title, a, { role: 'display', maxLines: 2, maxSize: g.u * 15 });
      drawText(g, Lt, a.x, a.y + a.h - Lt.h, textOpts(P, lt, { start: 0, stagger: 0.05, exitAt: exitAt(S) }));
      area = b;
    }
    const n = Math.max(1, items.length), max = Math.max(1e-9, ...items.map((i) => i.value));
    const hi = p.highlight != null ? num(p.highlight) : items.findIndex((i) => i.value === max);
    const rowH = Math.min(area.h / n, g.u * (g.portrait ? 34 : 24)), y0 = area.y + (area.h - rowH * n) / 2;
    const labelSize = Math.min(g.u * 6.5, rowH * 0.24), barH = rowH * 0.4;
    const at = slots(S, n, 0.5, p.title ? S.beat * 0.5 : S.beat * 0.25);
    const dec = items.some((i) => i.value % 1) ? 1 : 0;
    const valW = (() => { g.font(barH * 0.8, 'display', { caps: false }); return Math.max(...items.map((i) => g.measure(fmt(i.value, dec) + (p.unit || '')))) + g.u * 2; })();
    items.forEach((it, k) => {
      const ry = y0 + k * rowH, t0 = at[k];
      const gp = ease.outExpo(clamp((lt - t0) / 1.0)) * (1 - ew(lt, (exitAt(S) ?? 1e9) + k * 0.03, 0.3, ease.inExpo));
      const L = g.fit(it.label, { x: 0, y: 0, w: area.w, h: labelSize }, { role: 'text', maxLines: 1, maxSize: labelSize, weight: 600 });
      drawText(g, L, area.x, ry, textOpts(P, lt, { start: t0, stagger: 0.03, mode: 'rise', exitAt: exitAt(S) }));
      const bw = Math.max(barH * 0.2, (area.w - valW) * (it.value / max)) * gp;
      const by = ry + labelSize + g.u * 2;
      const col = k === hi ? (P.ground === 'accent' ? P.ink : P.accent) : alpha(P.ink, 0.85);
      g.rrect(area.x, by, bw, barH, Math.min(g.style.radius, barH / 2), col);
      if (gp > 0.02) {
        g.font(barH * 0.8, 'display', { caps: false });
        g.text(fmt(it.value * clamp(gp * 1.02), dec) + (p.unit || ''), area.x + bw + g.u * 2, by + barH * 0.82, P.ink);
      }
    });
  },
  cues(p, S) { const n = arr(p.items).length; return slots(S, n, 0.5, p.title ? S.beat * 0.5 : S.beat * 0.25).map((t) => ({ t, sfx: 'pop', gain: 0.5 })); },
};

export const linechart = {
  beats: 8,
  describe: 'A line chart that draws itself with a glowing-free head dot and a rolling value; for growth/trend stories.',
  props: { title: 'optional, <= 7 words', points: 'array of 4-12 numbers', value: 'headline value shown at the end, e.g. "+312%"', label: 'optional caption' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, pts = arr(p.points).map((v) => num(v, 0));
    if (pts.length < 2) pts.push(0, 1);
    const [a, b] = splitV(box, g.portrait ? 0.3 : 0.3, g.u * 4);
    if (p.title) {
      const Lt = g.fit(p.title, a, { role: 'display', maxLines: 2, maxSize: g.u * 17 });
      drawText(g, Lt, a.x, a.y + (a.h - Lt.h) * 0.3, textOpts(P, lt, { start: 0, stagger: 0.05, exitAt: exitAt(S) }));
    }
    const ch = { x: b.x, y: b.y + g.u * 4, w: b.w, h: b.h - g.u * (p.label ? 16 : 8) };
    const lo = Math.min(...pts), hiV = Math.max(...pts), rng = hiV - lo || 1;
    const P2 = pts.map((v, i) => [ch.x + (i / (pts.length - 1)) * ch.w, ch.y + ch.h - ((v - lo) / rng) * ch.h]);
    const ctx = g.ctx;
    // Grid lines draw first.
    for (let k = 0; k <= 3; k++) {
      const gy = ch.y + (k / 3) * ch.h, gp = ew(lt, k * 0.06, 0.6);
      g.rect(ch.x, gy, ch.w * gp, Math.max(1, g.u * 0.18), alpha(P.ink, 0.18));
    }
    const head = ease.inOutCubic(clamp((lt - S.beat * 0.5) / (S.dur * 0.55)));
    const segs = (P2.length - 1) * head, n = Math.floor(segs), f = segs - n;
    const path = P2.slice(0, n + 1);
    if (n < P2.length - 1) path.push([lerp(P2[n][0], P2[n + 1][0], f), lerp(P2[n][1], P2[n + 1][1], f)]);
    const col = P.ground === 'accent' ? P.ink : P.accent;
    if (path.length > 1) {
      ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.lineTo(path[path.length - 1][0], ch.y + ch.h); ctx.lineTo(path[0][0], ch.y + ch.h); ctx.closePath();
      ctx.fillStyle = alpha(col, 0.14); ctx.fill();
      ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = col; ctx.lineWidth = g.u * 1.1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      const [hx, hy] = path[path.length - 1];
      g.circle(hx, hy, g.u * 2.2, P.ink); g.circle(hx, hy, g.u * 1.1, col);
    }
    if (p.value) {
      const vp = sp(lt - (S.beat * 0.5 + S.dur * 0.55), 'ui');
      if (vp > 0.01) {
        const L = g.fit(String(p.value), { x: 0, y: 0, w: ch.w * 0.6, h: g.u * 16 }, { role: 'display', maxLines: 1, caps: false });
        const [hx, hy] = P2[P2.length - 1];
        g.save(); const ctx2 = g.ctx; ctx2.translate(Math.min(hx, ch.x + ch.w) - L.w, hy - g.u * 5); ctx2.scale(vp, vp);
        g.font(L.size, 'display', { caps: false }); g.text(String(p.value), 0, 0, P.ink); g.restore();
      }
    }
    if (p.label) {
      const L = g.fit(p.label, { x: 0, y: 0, w: ch.w, h: g.u * 5 }, { role: 'text', maxLines: 1, maxSize: g.u * 4.5 });
      drawText(g, L, ch.x, ch.y + ch.h + g.u * 3, textOpts(P, lt, { start: S.beat, stagger: 0.03, exitAt: exitAt(S) }));
    }
  },
  cues: (p, S) => [{ t: S.beat * 0.5, sfx: 'riser', gain: 0.45, dur: S.dur * 0.55 }, { t: S.beat * 0.5 + S.dur * 0.55, sfx: 'thump', gain: 0.7 }],
};

export const compare = {
  beats: 8,
  describe: 'Split screen before/after or old/new. Left side dims, right side wins in accent. Values roll if numeric.',
  props: { left: '{label, value}', right: '{label, value}', title: 'optional, <= 6 words' },
  draw(g, p, lt, S) {
    const P = palette(g, S), G = g.style.grounds, ctx = g.ctx;
    const vertical = g.portrait;
    const other = S.ground === 'dark' ? 'light' : 'dark';
    const sides = [{ ...(p.left || {}), gr: G[S.ground] }, { ...(p.right || {}), gr: G[other] }];
    const split = ease.outExpo(clamp(lt / 0.9));
    const wob = vertical ? g.H / 2 : g.W / 2;
    const pos = lerp(vertical ? g.H : g.W, wob, split) + Math.sin(lt * 2) * g.u * 0.3;
    // Second half on the opposite ground.
    g.save(); ctx.beginPath();
    if (vertical) ctx.rect(0, pos, g.W, g.H - pos); else ctx.rect(pos, 0, g.W - pos, g.H);
    ctx.clip(); g.bg(sides[1].gr.bg); g.restore();
    sides.forEach((sd, k) => {
      const area = vertical
        ? { x: g.safe.x, y: k ? g.H / 2 + g.u * 7 : g.safe.y, w: g.safe.w, h: (k ? g.safe.b - g.H / 2 : g.H / 2 - g.safe.y) - g.u * 7 }
        : { x: k ? g.W / 2 + g.u * 7 : g.safe.x, y: g.safe.y, w: g.W / 2 - g.safe.x - g.u * 7, h: g.safe.h };
      const t0 = k ? S.beat * 1.5 : S.beat * 0.5;
      const ink = sd.gr.ink, acc = k ? (sd.gr === G.accent ? sd.gr.ink : sd.gr.accent) : alpha(sd.gr.ink, 0.55);
      const Pk = { ...P, ink, accent: acc, bg: sd.gr.bg };
      const Ll = g.fit(String(sd.label || ''), { x: 0, y: 0, w: area.w, h: g.u * 6 }, { role: 'text', maxLines: 2, maxSize: g.u * 5.5, weight: 600 });
      drawText(g, Ll, area.x, area.y + area.h * 0.18, textOpts(Pk, lt, { start: t0, stagger: 0.04, exitAt: exitAt(S) }));
      const val = String(sd.value ?? '');
      const Lv = g.fit(val, { x: 0, y: 0, w: area.w, h: area.h * 0.55 }, { role: 'display', maxLines: 2, caps: false });
      drawText(g, Lv, area.x, area.y + area.h * 0.18 + Ll.h + g.u * 5, textOpts(Pk, lt, { start: t0 + 0.15, stagger: 0.07, ink: k ? acc : alpha(ink, 0.55), exitAt: exitAt(S) }));
      if (!k) { // strike the loser
        const sp1 = ew(lt, S.beat * 2.5, 0.5, ease.outExpo);
        const sy = area.y + area.h * 0.18 + Ll.h + g.u * 5 + Lv.capH * 0.55;
        g.rect(area.x - g.u, sy, (Lv.w + g.u * 2) * sp1, Math.max(4, Lv.size * 0.06), alpha(ink, 0.8));
      }
    });
    // The seam
    const sw = Math.max(4, g.u * 0.6);
    g.rect(vertical ? 0 : pos - sw / 2, vertical ? pos - sw / 2 : 0, vertical ? g.W : sw, vertical ? sw : g.H, G.accent.bg);
    if (p.title) {
      const L = g.fit(p.title, { x: 0, y: 0, w: g.safe.w * 0.8, h: g.u * 7 }, { role: 'text', maxLines: 1, weight: 700 });
      const tx = vertical ? g.safe.x : g.W / 2 - L.w / 2, ty = vertical ? pos - g.u * 4 - L.h : g.safe.y;
      if (!vertical) { g.rrect(tx - g.u * 2, ty - g.u * 1.5, L.w + g.u * 4, L.h + g.u * 3, g.style.radius, G.accent.bg); }
      drawText(g, L, tx, ty, textOpts(P, lt, { start: 0.3, stagger: 0.03, ink: vertical ? P.ink : G.accent.ink, exitAt: exitAt(S) }));
    }
  },
  cues: (p, S) => [{ t: 0, sfx: 'whoosh', gain: 0.5, dur: 0.6 }, { t: S.beat * 1.5, sfx: 'pop', gain: 0.5 }, { t: S.beat * 2.5, sfx: 'click', gain: 0.6 }],
};

export const timeline = {
  beats: 8,
  describe: 'Milestones along a line that draws itself; 3-5 items with a short date/label and a few words each.',
  props: { title: 'optional', items: 'array of {label (e.g. 2019), text (<= 6 words)}' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, items = arr(p.items).slice(0, 5), n = Math.max(1, items.length);
    let area = box;
    if (p.title) {
      const [a, b] = splitV(box, 0.2, g.u * 3);
      const Lt = g.fit(p.title, a, { role: 'display', maxLines: 2, maxSize: g.u * 15 });
      drawText(g, Lt, a.x, a.y + a.h - Lt.h, textOpts(P, lt, { start: 0, stagger: 0.05, exitAt: exitAt(S) }));
      area = b;
    }
    const col = P.ground === 'accent' ? P.ink : P.accent;
    const lp = ease.inOutCubic(clamp((lt - S.beat * 0.25) / (S.dur * 0.6)));
    const at = items.map((_, k) => S.beat * 0.25 + (S.dur * 0.6) * ((k + 0.5) / n) * 0.98);
    if (g.portrait) {
      const lx = area.x + g.u * 2, rowH = (area.h - g.u * 8) / n;
      g.rect(lx - g.u * 0.3, area.y, g.u * 0.6, area.h * lp, alpha(P.ink, 0.5));
      items.forEach((it, k) => {
        const cy = area.y + rowH * (k + 0.5), np = sp(lt - at[k], g.style.motion.obj);
        if (np <= 0.001) return;
        g.circle(lx, cy, g.u * 2.2 * np, col);
        const Ll = g.fit(String(it.label ?? ''), { x: 0, y: 0, w: area.w - g.u * 10, h: g.u * 6 }, { role: 'mono', maxLines: 1, maxSize: g.u * 5.5 });
        drawText(g, Ll, lx + g.u * 7, cy - g.u * 8, textOpts(P, lt, { start: at[k], stagger: 0.02, ink: col, exitAt: exitAt(S) }));
        const Lx = g.fit(String(it.text ?? ''), { x: 0, y: 0, w: area.w - g.u * 10, h: rowH * 0.55 }, { role: 'display', maxLines: 2, maxSize: g.u * 13 });
        drawText(g, Lx, lx + g.u * 7, cy - g.u * 0.5, textOpts(P, lt, { start: at[k] + 0.08, stagger: 0.04, exitAt: exitAt(S) }));
      });
    } else {
      const ly = area.y + area.h * 0.5, colW = area.w / n;
      g.rect(area.x, ly - g.u * 0.3, area.w * lp, g.u * 0.6, alpha(P.ink, 0.5));
      items.forEach((it, k) => {
        const cx = area.x + colW * (k + 0.5), np = sp(lt - at[k], g.style.motion.obj), up = k % 2 === 0;
        if (np <= 0.001) return;
        g.circle(cx, ly, g.u * 2.2 * np, col);
        const tx = cx - colW * 0.45;
        const Ll = g.fit(String(it.label ?? ''), { x: 0, y: 0, w: colW * 0.9, h: g.u * 5 }, { role: 'mono', maxLines: 1, maxSize: g.u * 4.5 });
        const Lx = g.fit(String(it.text ?? ''), { x: 0, y: 0, w: colW * 0.9, h: area.h * 0.3 }, { role: 'display', maxLines: 3, maxSize: g.u * 7 });
        const by = up ? ly - g.u * 8 - Lx.h - Ll.h - g.u * 3 : ly + g.u * 8;
        drawText(g, Ll, tx, by, textOpts(P, lt, { start: at[k], stagger: 0.02, ink: col, exitAt: exitAt(S) }));
        drawText(g, Lx, tx, by + Ll.h + g.u * 3, textOpts(P, lt, { start: at[k] + 0.08, stagger: 0.04, exitAt: exitAt(S) }));
      });
    }
  },
  cues(p, S) { const n = arr(p.items).length || 1; return arr(p.items).map((_, k) => ({ t: S.beat * 0.25 + (S.dur * 0.6) * ((k + 0.5) / n) * 0.98, sfx: 'pop', gain: 0.5 })); },
};
