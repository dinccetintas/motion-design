// Core math for a film that is a pure function of time.
// Everything here is stateless: same input, same output, on every machine.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
export const smoothstep = (a, b, x) => { const p = invLerp(a, b, x); return p * p * (3 - 2 * p); };
export const TAU = Math.PI * 2;

/** Damped spring from 0 to 1 as a closed-form function of time (seconds). */
export function spring(t, k = 170, d = 26) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/** Named spring presets. Type never overshoots; UI and objects may. */
export const SPRINGS = {
  type: [320, 2 * Math.sqrt(320)],   // critically damped, fast
  snap: [520, 2 * Math.sqrt(520)],   // critically damped, very fast
  soft: [90, 2 * Math.sqrt(90)],     // critically damped, slow and calm
  ui: [300, 24],                     // slight overshoot
  bounce: [260, 13],                 // playful overshoot
  heavy: [140, 20],                  // weighty landing
};
export const sp = (t, name = 'type') => { const [k, d] = SPRINGS[name] || SPRINGS.type; return spring(t, k, d); };

/** A punch: rises fast at `at`, settles back to 0. Peak is roughly amp. */
export const bump = (t, at, amp = 1) => amp * 1.6 * (sp(t - at, 'snap') - sp(t - at, 'soft'));

/** keys: [[time, value], ...]. One spring per change, stacked, so motion is continuous. */
export function track(t, keys, name = 'ui') {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * sp(t - keys[i][0], name);
  return v;
}

/** Strong easing curves (Emil Kowalski / Penner family). All map [0,1] -> [0,1]. */
export const ease = {
  linear: (p) => p,
  outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  inExpo: (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
  inOutExpo: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
  outCubic: (p) => 1 - Math.pow(1 - p, 3),
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outQuart: (p) => 1 - Math.pow(1 - p, 4),
  inOutQuart: (p) => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
  inCubic: (p) => p * p * p,
  outBack: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
};
/** Eased progress of x through the window [a, a+dur]. */
export const ew = (x, a, dur, fn = ease.outExpo) => fn(clamp((x - a) / dur));

/** Deterministic hash -> [0,1). Integer-friendly, no state. */
export function hash(n, seed = 0) {
  let h = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const hash2 = (x, y, seed = 0) => hash((x | 0) * 73856093 ^ (y | 0) * 19349663, seed);

/** Seeded PRNG for building deterministic layouts (not for per-frame state). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}
/** Smooth 2D value noise in [-1, 1]. */
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}

// ---- Color --------------------------------------------------------------

export function hexToRgb(hex) {
  let h = String(hex).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, p) => { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex(x.map((v, i) => v + (y[i] - v) * clamp(p))); };
export const alpha = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${clamp(a)})`; };

/** WCAG relative luminance. */
export function luminance(hex) {
  const c = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** Pick whichever candidate reads best on bg. */
export const bestOn = (bg, ...cands) => cands.reduce((best, c) => (contrast(c, bg) > contrast(best, bg) ? c : best), cands[0]);
