// showcase/lib.js — timing, springs, palette and type helpers for MATTER.
// Everything is a pure function of its inputs: the film is window.seek(t).

const QS = new URLSearchParams(location.search);
const V = QS.get('v') === '1';                 // vertical 1080x1920 cut
const W = V ? 1080 : 1920, H = V ? 1920 : 1080;
const CX = W / 2, CY = H / 2;
const U = Math.min(W, H) / 1080;               // unit scale: 1 at 1080p landscape
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const FPS = 30;

// ---- Beat grid: 120 BPM, six 8 s sections ----
const BEAT = 0.5;
const SEC = { ink: 0, clay: 8, fire: 16, heat: 24, paint: 32, desk: 40, end: 48 };
const at = (sec, b) => SEC[sec] + b * BEAT;

// ---- Palette (docs/matter_shotlist.md) ----
const C = {
  black: '#0A0A0A', white: '#F4F3EF',
  cobalt: '#0B3FA6', clay: '#C8643C', sand: '#EFE6D8', coral: '#F07A5F',
  midnight: '#0A1A3A', amber: '#FFB347',
  lime: '#C8FF2A', magenta: '#FF2BD6',
  purple: '#4A2A6A', orange: '#F07A2A', gold: '#F5C04A',
  paper: '#EDE6D6', ink: '#1A1612',
};
const F = { display: '"Barlow Condensed", sans-serif', ui: '"Space Grotesk", sans-serif' };

// ---- Springs (closed form, lib/motion.js) ----
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
function spring(t, k = 170, d = 26) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
// type: critically damped. ui: ~5% overshoot. heavy: soft, for big objects and camera.
const typeS = (t, k = 200) => spring(t, k, 2 * Math.sqrt(k));
const uiS = (t, k = 260) => spring(t, k, 0.68 * 2 * Math.sqrt(k));
const heavyS = (t, k = 40) => spring(t, k, 0.92 * 2 * Math.sqrt(k));
/** Linear ramp 0..1 between t0 and t1. */
const ramp = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
/** 1 while t in [t0, t1), else 0. */
const within = (t, t0, t1) => (t >= t0 && t < t1 ? 1 : 0);

// ---- Colour ----
const rgbOf = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a, b, p) {
  const pa = rgbOf(a), pb = rgbOf(b), q = clamp(p);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * q)).join(',')})`;
}
function rgba(hex, a) { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; }

// ---- Drawing ----
function bg(col) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
function font(weight, size, fam = F.display) { ctx.font = `${weight} ${size}px ${fam}`; }
function rr(x, y, w, h, r) {
  w = Math.max(0, w); h = Math.max(0, h);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}
/** Tracked text: draws `s` with `track` px between glyphs; returns the width. */
function tracked(s, x, y, track, align = 'left') {
  const chars = [...s];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + track; });
  return total;
}
/** Text that rises into place from behind a mask line. p: 0 hidden -> 1 set. */
function riseText(s, x, y, size, p, color, align = 'left') {
  if (p <= 0.001) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(-W, y - size * 1.05, 3 * W, size * 1.35); ctx.clip();
  ctx.fillStyle = color; ctx.textAlign = align;
  ctx.fillText(s, x, y + (1 - p) * size * 1.3);
  ctx.restore();
}
/** Per-letter rise, staggered by `step` seconds from t0; returns total width. */
function riseLetters(s, x, y, size, t, t0, step, color, align = 'left', k = 220) {
  const chars = [...s];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save();
  ctx.beginPath(); ctx.rect(-W, y - size * 1.05, 3 * W, size * 1.35); ctx.clip();
  ctx.fillStyle = color; ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    const p = typeS(t - t0 - i * step, k);
    if (p > 0.001) ctx.fillText(ch, cx, y + (1 - p) * size * 1.3);
    cx += widths[i];
  });
  ctx.restore();
  return total;
}
/** Chapter label "NN — NAME" in condensed caps with a hairline underneath. */
function chapterLabel(num, name, x, y, size, color, p = 1) {
  if (p <= 0.001) return;
  ctx.save();
  font(800, size); ctx.fillStyle = color;
  riseText(`${num}`, x, y, size, p, color);
  const nw = ctx.measureText(num).width;
  font(500, size * 0.34, F.ui);
  riseText(name.toUpperCase(), x + nw + size * 0.28, y - size * 0.06, size * 0.34, p, color);
  ctx.fillStyle = color; ctx.globalAlpha *= p;
  ctx.fillRect(x, y + size * 0.16, (nw + size * 0.28 + ctx.measureText(name.toUpperCase()).width) * p, Math.max(2, 2 * U));
  ctx.restore();
}
/** Odometer digits: value rolls continuously; `digits` places, zero padded. */
function odometer(value, digits, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.textAlign = 'left';
  ctx.beginPath(); ctx.rect(x - 10, y - size * 0.82, 4000, size * 0.9); ctx.clip();
  const dw = ctx.measureText('0').width;
  for (let place = digits - 1; place >= 0; place--) {
    const cont = value / Math.pow(10, place);
    const d = Math.floor(cont) % 10, f = cont - Math.floor(cont);
    const roll = place === 0 ? f : (f > 0.85 ? (f - 0.85) / 0.15 : 0);
    ctx.fillText(String(d), x, y - roll * size);
    ctx.fillText(String((d + 1) % 10), x, y + (1 - roll) * size);
    x += dw;
  }
  ctx.restore();
}
/** Current slot index for a strobe/burst starting at t0 with `step` seconds per slot. */
const slot = (t, t0, step) => Math.floor((t - t0) / step);
