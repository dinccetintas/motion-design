// Graphics helpers bound to one canvas, one frame size, one style.
// Text layout is measured, wrapped and fitted so any copy fits its box; every text
// draw is optionally recorded (probe) in frame space so validators can check
// overflow, overlap, size and contrast without guessing.
import { clamp, hexToRgb } from './core.js';

const STRETCH = ['ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed', 'normal',
  'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded'];
const STRETCH_PCT = [50, 62.5, 75, 87.5, 100, 112.5, 125, 150, 200];

/** Parse "Make it *fast*" into word runs with an accent flag. */
export function parseRich(str) {
  const words = [];
  let accent = false;
  for (const raw of String(str ?? '').split(/(\*)/)) {
    if (raw === '*') { accent = !accent; continue; }
    const parts = raw.split(/(\s+)/);
    parts.forEach((w, i) => {
      if (!w || /^\s+$/.test(w)) return;
      // Punctuation right after a closing accent ("*light*.") belongs to that word.
      if (i === 0 && words.length && !/^\s/.test(raw) && /^[.,;:!?…)”’"']+$/.test(w)) { words[words.length - 1].text += w; return; }
      words.push({ text: w, accent });
    });
  }
  return words;
}
export const plain = (str) => String(str ?? '').replace(/\*/g, '');

export class Gfx {
  constructor(ctx, W, H, style) {
    this.ctx = ctx; this.W = W; this.H = H; this.style = style;
    this.u = Math.min(W, H) / 100;               // 1u = 1% of the short side
    this.portrait = H > W * 1.2; this.landscape = W > H * 1.2;
    // Safe area: platform UI covers top/bottom of vertical video.
    const sx = this.u * 7, sy = this.portrait ? H * 0.11 : this.u * 7;
    const sb = this.portrait ? H * 0.14 : this.u * 7;
    this.safe = { x: sx, y: sy, w: W - 2 * sx, h: H - sy - sb, r: W - sx, b: H - sb };
    this.probe = null;                            // array when probing
    this._mcache = new Map();
  }

  // ---- fonts ---------------------------------------------------------------
  fontFor(role) { return role === 'text' ? this.style.fonts.text : role === 'mono' ? this.style.fonts.mono || this.style.fonts.text : this.style.fonts.display; }
  /** Set font. role: display|text|mono. opts: weight, italic, stretch (percent), tracking (em). */
  font(size, role = 'display', opts = {}) {
    const f = this.fontFor(role);
    const weight = opts.weight ?? (role === 'display' ? f.weight : f.weight ?? 400);
    const italic = opts.italic ?? false;
    let stretch = opts.stretch ?? (role === 'display' ? f.stretch ?? 100 : 100);
    // Canvas only takes keywords; snap to the nearest one inside the font's range.
    const [lo, hi] = f.stretchRange || [100, 100];
    stretch = clamp(stretch, lo, hi);
    let best = 4, bd = 1e9;
    STRETCH_PCT.forEach((p, i) => { if (p >= lo - 0.1 && p <= hi + 0.1 && Math.abs(p - stretch) < bd) { bd = Math.abs(p - stretch); best = i; } });
    const ctx = this.ctx;
    // ctx.font resets fontStretch, so stretch must be set after it.
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${Math.max(1, size).toFixed(2)}px "${f.family}"`;
    ctx.fontStretch = STRETCH[best];
    const tr = opts.tracking ?? (role === 'display' ? f.tracking ?? 0 : f.tracking ?? 0);
    ctx.letterSpacing = `${(tr * size).toFixed(2)}px`;
    const cap = opts.caps ?? (role === 'display' ? f.caps : false);
    this._caps = !!cap;
    this._fkey = ctx.font + ctx.fontStretch + ctx.letterSpacing;
    this._size = size;
    return this;
  }
  cased(s) { return this._caps ? String(s).toUpperCase() : String(s); }
  measure(s) {
    const k = this._fkey + '|' + s;
    let v = this._mcache.get(k);
    if (v === undefined) { v = this.ctx.measureText(this.cased(s)).width; if (this._mcache.size > 20000) this._mcache.clear(); this._mcache.set(k, v); }
    return v;
  }

  // ---- layout ---------------------------------------------------------------
  /** Greedy wrap of word runs into lines no wider than maxW (with current font). */
  /** Width of a word run; italic accents are measured in the italic cut they are drawn in. */
  wordW(wd) {
    if (!wd.accent || !this._italicAccents) return this.measure(wd.text);
    const font = this.ctx.font, fk = this._fkey;
    this.ctx.font = 'italic ' + font.replace(/^italic\s+/, '');
    this._fkey = fk + '|i';
    const w = this.measure(wd.text) * 1.04;
    this.ctx.font = font; this._fkey = fk;
    return w;
  }
  wrapWords(words, maxW) {
    const sp = this.measure(' ');
    const lines = []; let cur = [], w = 0;
    for (const wd of words) {
      const ww = this.wordW(wd);
      if (cur.length && w + sp + ww > maxW) { lines.push(cur); cur = []; w = 0; }
      cur.push(wd); w += (cur.length > 1 ? sp : 0) + ww;
    }
    if (cur.length) lines.push(cur);
    return lines;
  }
  /** Re-wrap to the narrowest width that keeps the same line count (balanced rag). */
  balance(words, maxW) {
    const n = this.wrapWords(words, maxW).length;
    if (n <= 1) return this.wrapWords(words, maxW);
    let lo = maxW * 0.4, hi = maxW;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (this.wrapWords(words, mid).length > n) lo = mid; else hi = mid; }
    return this.wrapWords(words, hi);
  }
  /**
   * Fit rich text into a box: largest size where it wraps into <= maxLines and fits.
   * Returns { size, lineH, lines: [{words:[{text,accent,x,w}], w, y}], w, h }.
   * Positions are relative to the box's top-left; y is the baseline of each line.
   */
  fit(str, box, o = {}) {
    const role = o.role || 'display';
    const words = typeof str === 'string' ? parseRich(str) : str;
    const lh = o.lineHeight ?? (role === 'display' ? this.fontFor(role).lineHeight ?? 0.92 : 1.25);
    const maxLines = o.maxLines ?? 4;
    const maxSize = o.maxSize ?? box.h, minSize = o.minSize ?? this.u * 3.6;
    this._italicAccents = role === 'display' && this.style.accentStyle === 'italic' && o.accentStyle !== 'none';
    const tryAt = (size) => {
      this.font(size, role, o);
      // A single word wider than the box can never fit at this size.
      for (const w of words) if (this.wordW(w) > box.w) return null;
      const lines = o.balance === false ? this.wrapWords(words, box.w) : this.balance(words, box.w);
      const h = size * (1 + (lines.length - 1) * lh);
      if (lines.length > maxLines || h > box.h) return null;
      return lines;
    };
    let lo = minSize, hi = maxSize, best = null, bestSize = minSize;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2, r = tryAt(mid);
      if (r) { best = r; bestSize = mid; lo = mid; } else hi = mid;
    }
    if (!best) { bestSize = minSize; this.font(minSize, role, o); best = this.wrapWords(words, box.w); }
    this.font(bestSize, role, o);
    const sp = this.measure(' ');
    const capH = bestSize * (this.fontFor(role).capHeight ?? 0.72);
    const out = best.map((ws, li) => {
      let x = 0;
      const placed = ws.map((wd) => { const w = this.wordW(wd); const r = { ...wd, x, w }; x += w + sp; return r; });
      return { words: placed, w: x - sp, y: capH + li * bestSize * lh };
    });
    const h = capH + (out.length - 1) * bestSize * lh;
    const align = o.align || 'left';
    for (const l of out) {
      const dx = align === 'center' ? (box.w - l.w) / 2 : align === 'right' ? box.w - l.w : 0;
      for (const w of l.words) w.x += dx;
      l.x = dx;
    }
    this._italicAccents = false;
    return { size: bestSize, lineH: bestSize * lh, capH, lines: out, w: Math.max(...out.map((l) => l.w)), h, role, opts: o };
  }

  // ---- drawing --------------------------------------------------------------
  /** Draw a string at baseline (x, y) with the current font. Records into probe. */
  text(s, x, y, color, o = {}) {
    const ctx = this.ctx, str = this.cased(s);
    ctx.fillStyle = color;
    if (o.stroke) { ctx.strokeStyle = color; ctx.lineWidth = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    else ctx.fillText(str, x, y);
    if (this.probe && ctx.globalAlpha > 0.6 && !o.decor) this.record(str, x, y, color, o);
  }
  record(str, x, y, color, o = {}) {
    const ctx = this.ctx, m = ctx.getTransform();
    // Exact ink bounds, so tightly stacked caps don't read as overlapping.
    const tm = ctx.measureText(str), size = this._size;
    // Ink spans [x - left, x + right]; left is negative when the string starts with a space.
    const xl = x - tm.actualBoundingBoxLeft, xr = x + tm.actualBoundingBoxRight;
    const asc = tm.actualBoundingBoxAscent, desc = Math.max(0, tm.actualBoundingBoxDescent);
    const pts = [[xl, y - asc], [xr, y - asc], [xl, y + desc], [xr, y + desc]]
      .map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const scale = Math.hypot(m.a, m.b);
    const clip = this._clip;
    this.probe.push({ text: str, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys),
      size: size * scale, color, stroke: !!o.stroke, clip: clip ? { ...clip } : null });
  }
  /** Track the active clip rect (frame space) so probe ignores clipped-away text. */
  clipRect(x, y, w, h) {
    const ctx = this.ctx; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const m = ctx.getTransform();
    this._clip = { x0: m.a * x + m.e, y0: m.d * y + m.f, x1: m.a * (x + w) + m.e, y1: m.d * (y + h) + m.f };
  }
  save() { this.ctx.save(); this._clipStack = this._clipStack || []; this._clipStack.push(this._clip); }
  restore() { this.ctx.restore(); this._clip = this._clipStack.pop(); }

  bg(color) { this.ctx.fillStyle = color; this.ctx.fillRect(0, 0, this.W, this.H); }
  rect(x, y, w, h, color) { this.ctx.fillStyle = color; this.ctx.fillRect(x, y, w, h); }
  rrect(x, y, w, h, r, color) {
    const ctx = this.ctx; r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
  }
  circle(x, y, r, color) { const ctx = this.ctx; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  line(x0, y0, x1, y1, color, w) {
    const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  }
  /** Draw an image covering a box (object-fit: cover), with optional focal offsets. */
  cover(img, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
    if (!img) return;
    const iw = img.width, ih = img.height, s = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * s, dh = ih * s;
    this.ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
  }
  /** Luminance of a hex, 0..1, used to choose readable ink. */
  lum(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
}
