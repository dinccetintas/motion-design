// Pure-JS synthesis: oscillators, filters, envelopes, reverb and mastering on Float32Arrays.
// Deterministic, fast, and identical in Node and the browser (no WebAudio graph).
import { rng } from '../core.js';

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TWO_PI = Math.PI * 2;

function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

/** RBJ biquad with cheap per-block coefficient updates. */
export class Biquad {
  constructor(sr, type, f, q = 0.707, gainDb = 0) { this.sr = sr; this.type = type; this.q = q; this.gainDb = gainDb; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f); }
  set(f, q = this.q) {
    f = Math.min(Math.max(f, 10), this.sr * 0.45); this.q = q;
    const w = TWO_PI * f / this.sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    switch (this.type) {
      case 'lp': b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; break;
      case 'hp': b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; break;
      case 'bp': b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; break;
      default: { const A = Math.pow(10, this.gainDb / 40); b0 = 1 + a * A; b1 = -2 * c; b2 = 1 - a * A; a0 = 1 + a / A; a1 = -2 * c; a2 = 1 - a / A; }
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  tick(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** The mixing desk: stereo buses that voices write into. */
export class Desk {
  constructor(sr, dur, seed = 1) {
    this.sr = sr; this.n = Math.ceil(sr * dur);
    const mk = () => [new Float32Array(this.n), new Float32Array(this.n)];
    this.bus = { music: mk(), drums: mk(), sfx: mk(), send: mk() };
    const r = rng(seed * 7919 + 13);
    this.noise = new Float32Array(sr * 2); for (let i = 0; i < this.noise.length; i++) this.noise[i] = r() * 2 - 1;
  }
  nz(i) { return this.noise[i % this.noise.length]; }
  /** Add mono samples at time t to a bus with constant-power pan and a reverb send. */
  add(bus, t, mono, gain = 1, pan = 0, send = 0) {
    const s0 = Math.round(t * this.sr), [L, R] = this.bus[bus], [SL, SR] = this.bus.send;
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
    const end = Math.min(this.n, s0 + mono.length);
    for (let i = Math.max(0, s0); i < end; i++) {
      const v = mono[i - s0]; L[i] += v * gl; R[i] += v * gr;
      if (send) { SL[i] += v * gl * send; SR[i] += v * gr * send; }
    }
  }
  /** Add a stereo pair. */
  add2(bus, t, l, r, gain = 1, send = 0) {
    const s0 = Math.round(t * this.sr), [L, R] = this.bus[bus], [SL, SR] = this.bus.send;
    const end = Math.min(this.n, s0 + l.length);
    for (let i = Math.max(0, s0); i < end; i++) {
      L[i] += l[i - s0] * gain; R[i] += r[i - s0] * gain;
      if (send) { SL[i] += l[i - s0] * gain * send; SR[i] += r[i - s0] * gain * send; }
    }
  }
}

const len = (sr, d) => Math.max(1, Math.floor(sr * d));
const atk = (i, sr, a) => (a <= 0 ? 1 : Math.min(1, i / (sr * a)));

// ---- Drums -------------------------------------------------------------------
export function kick(D, t, v = 1, o = {}) {
  const sr = D.sr, dec = o.decay || 0.42, N = len(sr, dec * 2.2), out = new Float32Array(N);
  const top = o.top || 160, low = o.low || 52, sw = o.sweep || 0.09, drive = o.drive || 1.6;
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const tt = i / sr, f = low + (top - low) * Math.exp(-tt / (sw * 0.45));
    ph += f / sr;
    const a = atk(i, sr, 0.002) * Math.exp(-tt / (dec * 0.38));
    let s = Math.tanh(drive * Math.sin(TWO_PI * ph) * a) / Math.tanh(drive);
    if (tt < 0.012) s += D.nz(i * 7 + 13) * 0.55 * (1 - tt / 0.012);
    out[i] = s;
  }
  D.add('drums', t, out, v * 0.72);
}
export function clap(D, t, v = 1) {
  const sr = D.sr, N = len(sr, 0.3), out = new Float32Array(N), bp = new Biquad(sr, 'bp', 1400, 1.2);
  for (let i = 0; i < N; i++) {
    const tt = i / sr; let e;
    if (tt < 0.033) { const k = tt % 0.011; e = 0.05 + 0.85 * Math.exp(-k / 0.003); }
    else e = 0.9 * Math.exp(-(tt - 0.033) / 0.06);
    out[i] = bp.tick(D.nz(i + 1000)) * e * 2.2;
  }
  D.add('drums', t, out, v * 1.15, 0, 0.35);
}
export function snare(D, t, v = 1) {
  const sr = D.sr, N = len(sr, 0.3), out = new Float32Array(N), hp = new Biquad(sr, 'hp', 1200);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const tt = i / sr, f = 140 + 50 * Math.exp(-tt / 0.03); ph += f / sr;
    out[i] = hp.tick(D.nz(i + 3000)) * 0.8 * Math.exp(-tt / 0.06) + (Math.abs((ph % 1) * 4 - 2) - 1) * 0.6 * Math.exp(-tt / 0.04);
  }
  D.add('drums', t, out, v * 0.75, 0, 0.3);
}
export function hat(D, t, v = 1, open = false, pan = 0.25) {
  const sr = D.sr, dec = open ? 0.28 : 0.045, N = len(sr, dec * 3), out = new Float32Array(N);
  const hp = new Biquad(sr, 'hp', 7500, 0.8), hp2 = new Biquad(sr, 'hp', 7000, 0.7);
  for (let i = 0; i < N; i++) out[i] = hp2.tick(hp.tick(D.nz(i * 3 + 777))) * Math.exp(-(i / sr) / (dec * 0.4));
  D.add('drums', t, out, v * 0.5, pan);
}
export function rim(D, t, v = 1) {
  const sr = D.sr, N = len(sr, 0.06), out = new Float32Array(N), bp = new Biquad(sr, 'bp', 1800, 4);
  for (let i = 0; i < N; i++) out[i] = bp.tick(((i * 1700 / sr) % 1) < 0.5 ? 1 : -1) * Math.exp(-(i / sr) / 0.012);
  D.add('drums', t, out, v * 0.6, -0.2);
}
export function shaker(D, t, v = 1) {
  const sr = D.sr, N = len(sr, 0.1), out = new Float32Array(N), bp = new Biquad(sr, 'bp', 6000, 0.8);
  for (let i = 0; i < N; i++) { const tt = i / sr; out[i] = bp.tick(D.nz(i + 5000)) * (tt < 0.03 ? tt / 0.03 : Math.exp(-(tt - 0.03) / 0.02)); }
  D.add('drums', t, out, v * 0.16, 0.4);
}
export function tom(D, t, v = 1, f = 90) {
  const sr = D.sr, N = len(sr, 0.8), out = new Float32Array(N); let ph = 0;
  for (let i = 0; i < N; i++) { const tt = i / sr; ph += (f + f * 0.8 * Math.exp(-tt / 0.04)) / sr; out[i] = Math.sin(TWO_PI * ph) * atk(i, sr, 0.003) * Math.exp(-tt / 0.22); }
  D.add('drums', t, out, v * 0.9, 0, 0.2);
}

// ---- Tonal -------------------------------------------------------------------
export function bass(D, t, m, dur, v = 1, o = {}) {
  const sr = D.sr, f = midiHz(m), N = len(sr, dur + 0.03), out = new Float32Array(N);
  const cut = (o.cut || 260) * 1.6, lp = new Biquad(sr, 'lp', cut * 2.2, o.q || 3), dt = f / sr;
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const tt = i / sr;
    if (i % 32 === 0) lp.set(cut + cut * 1.4 * Math.exp(-tt / 0.08));
    ph = (ph + dt) % 1;
    const wave = o.wave === 'sine' ? 0 : o.wave === 'triangle' ? (Math.abs(ph * 4 - 2) - 1) : (2 * ph - 1 - polyblep(ph, dt));
    const s = 0.6 * wave + 0.45 * Math.sin(TWO_PI * ph);
    const rel = tt > dur ? Math.max(0, 1 - (tt - dur) / 0.03) : 1;
    out[i] = lp.tick(s) * atk(i, sr, 0.004) * rel * (0.75 + 0.25 * Math.exp(-tt / 0.2));
  }
  D.add('music', t, out, v * 0.45);
}
export function sub808(D, t, m, dur, v = 1, glideFrom = null) {
  const sr = D.sr, f = midiHz(m), f0 = glideFrom != null ? midiHz(glideFrom) : f, N = len(sr, dur + 0.05), out = new Float32Array(N);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const tt = i / sr; ph += (f + (f0 - f) * Math.exp(-tt / 0.03)) / sr;
    const e = atk(i, sr, 0.003) * Math.exp(-tt / (dur * 0.6)) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.05) : 1);
    out[i] = Math.tanh(2.2 * Math.sin(TWO_PI * ph) * e) * 0.8;
  }
  D.add('music', t, out, v * 0.85);
}
export function pad(D, t, notes, dur, v = 1, o = {}) {
  const sr = D.sr, rel = 0.6, N = len(sr, dur + rel), L = new Float32Array(N), R = new Float32Array(N);
  const cut = o.cut || 1600, a = o.attack ?? Math.min(0.6, dur * 0.3);
  const lpL = new Biquad(sr, 'lp', cut * 0.5, 0.6), lpR = new Biquad(sr, 'lp', cut * 0.5, 0.6);
  const voices = [];
  notes.forEach((m, k) => [-9, -3, 4, 10].forEach((d, j) => voices.push({ dt: midiHz(m) * Math.pow(2, d / 1200) / sr, ph: ((k * 0.37 + j * 0.19) % 1), side: j % 2 })));
  const norm = 0.11 / Math.sqrt(voices.length);
  for (let i = 0; i < N; i++) {
    const tt = i / sr;
    if (i % 64 === 0) { const c = cut * (0.5 + 0.5 * Math.min(1, tt / (dur * 0.6 + 0.01))); lpL.set(c); lpR.set(c * 1.05); }
    let l = 0, r = 0;
    for (const vo of voices) { vo.ph += vo.dt; if (vo.ph >= 1) vo.ph -= 1; const s = 2 * vo.ph - 1 - polyblep(vo.ph, vo.dt); if (vo.side) r += s; else l += s; }
    const e = Math.min(1, tt / Math.max(0.005, a)) * (tt > dur ? Math.max(0, 1 - (tt - dur) / rel) : 1);
    L[i] = lpL.tick(l) * e * norm; R[i] = lpR.tick(r) * e * norm;
  }
  D.add2('music', t, L, R, v * 1.9, 0.6);
}
export function pluck(D, t, m, v = 1, o = {}) {
  const sr = D.sr, f = midiHz(m), dec = o.decay || 0.3, N = len(sr, dec * 2.5), out = new Float32Array(N);
  const lp = new Biquad(sr, 'lp', o.bright || 5000, 1.6), d1 = f * Math.pow(2, -6 / 1200) / sr, d2 = f * Math.pow(2, 6 / 1200) / sr;
  let p1 = 0, p2 = 0.3;
  for (let i = 0; i < N; i++) {
    const tt = i / sr;
    if (i % 32 === 0) lp.set(500 + (o.bright || 5000) * Math.exp(-tt / (dec * 0.35)));
    p1 = (p1 + d1) % 1; p2 = (p2 + d2) % 1;
    const s = (2 * p1 - 1 - polyblep(p1, d1)) * 0.5 + ((p2 < 0.5 ? 1 : -1) + polyblep(p2, d2) - polyblep((p2 + 0.5) % 1, d2)) * 0.35;
    out[i] = lp.tick(s) * atk(i, sr, 0.002) * Math.exp(-tt / (dec * 0.4));
  }
  D.add('music', t, out, v * 0.45, o.pan || 0, 0.4);
}
/** FM bell / electric-piano voice. */
export function keys(D, t, m, dur, v = 1, o = {}) {
  const sr = D.sr, f = midiHz(m), N = len(sr, dur + 1.0), out = new Float32Array(N);
  const ratio = o.ratio || 2, idx = o.index || 2.2, br = o.bright || 0.6;
  for (let i = 0; i < N; i++) {
    const tt = i / sr, I = idx * Math.exp(-tt / (br * 0.4)) + 0.05;
    const mod = Math.sin(TWO_PI * f * ratio * tt) * I;
    const e = atk(i, sr, 0.003) * Math.exp(-tt / ((dur + 0.6) * 0.35));
    out[i] = Math.sin(TWO_PI * f * tt + mod) * e;
  }
  D.add('music', t, out, v * 0.32, o.pan || 0, 0.5);
}

// ---- Sound effects -----------------------------------------------------------
export const SFX = {
  thump(D, t, v) { const o = D; kick(o, t, v * 1.1, { top: 120, low: 32, decay: 0.8, sweep: 0.15 }); },
  impact(D, t, v) {
    kick(D, t, v * 1.2, { top: 110, low: 30, decay: 1.4, sweep: 0.2, drive: 2.2 });
    const sr = D.sr, N = len(sr, 1.5), L = new Float32Array(N), R = new Float32Array(N);
    const lpL = new Biquad(sr, 'lp', 2500), lpR = new Biquad(sr, 'lp', 2500);
    for (let i = 0; i < N; i++) {
      const tt = i / sr; if (i % 64 === 0) { const c = 200 + 2300 * Math.exp(-tt / 0.3); lpL.set(c); lpR.set(c); }
      const e = atk(i, sr, 0.002) * Math.exp(-tt / 0.35);
      L[i] = lpL.tick(D.nz(i + 9000)) * e; R[i] = lpR.tick(D.nz(i + 21000)) * e;
    }
    D.add2('sfx', t, L, R, v * 0.5, 0.6);
  },
  tick(D, t, v) {
    const sr = D.sr, N = len(sr, 0.04), out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = Math.sin(TWO_PI * 2600 * i / sr) * Math.exp(-(i / sr) / 0.008);
    D.add('sfx', t, out, v * 0.35, 0.15);
  },
  click(D, t, v) {
    const sr = D.sr, N = len(sr, 0.05), out = new Float32Array(N); let ph = 0;
    for (let i = 0; i < N; i++) { const tt = i / sr; ph += (900 + 1000 * Math.exp(-tt / 0.01)) / sr; out[i] = (Math.abs((ph % 1) * 4 - 2) - 1) * Math.exp(-tt / 0.012) + D.nz(i + 333) * 0.3 * Math.exp(-tt / 0.003); }
    D.add('sfx', t, out, v * 0.5);
  },
  key(D, t, v) {
    const sr = D.sr, N = len(sr, 0.03), out = new Float32Array(N), bp = new Biquad(sr, 'bp', 3200 + ((t * 977) % 1200), 3);
    for (let i = 0; i < N; i++) out[i] = bp.tick(D.nz(i + Math.round(t * 1000))) * Math.exp(-(i / sr) / 0.006) * 2;
    D.add('sfx', t, out, v * 0.6, -0.2);
  },
  pop(D, t, v) {
    const sr = D.sr, N = len(sr, 0.15), out = new Float32Array(N); let ph = 0;
    for (let i = 0; i < N; i++) { const tt = i / sr; ph += (420 + 560 * Math.min(1, tt / 0.05)) / sr; out[i] = Math.sin(TWO_PI * ph) * atk(i, sr, 0.001) * Math.exp(-tt / 0.035); }
    D.add('sfx', t, out, v * 0.45);
  },
  whoosh(D, t, v, dur = 0.5) {
    dur = Math.max(0.2, Math.min(dur || 0.5, 2));
    const sr = D.sr, N = len(sr, dur + 0.3), L = new Float32Array(N), R = new Float32Array(N);
    const bl = new Biquad(sr, 'bp', 300, 1.4), br = new Biquad(sr, 'bp', 300, 1.4);
    const peak = dur * 0.85;
    for (let i = 0; i < N; i++) {
      const tt = i / sr;
      if (i % 64 === 0) { const f = tt < peak ? 300 * Math.pow(4200 / 300, tt / peak) : 4200 * Math.pow(1500 / 4200, Math.min(1, (tt - peak) / 0.25)); bl.set(f); br.set(f * 1.08); }
      const e = tt < peak ? Math.pow(tt / peak, 2.2) : Math.exp(-(tt - peak) / 0.07);
      L[i] = bl.tick(D.nz(i + 4444)) * e; R[i] = br.tick(D.nz(i + 15555)) * e;
    }
    D.add2('sfx', t, L, R, v * 0.9, 0.25);
  },
  swish(D, t, v) { SFX.whoosh(D, t, v * 0.6, 0.22); },
  riser(D, t, v, dur = 2) {
    dur = Math.max(0.5, Math.min(dur || 2, 6));
    const sr = D.sr, N = len(sr, dur), L = new Float32Array(N), R = new Float32Array(N), bl = new Biquad(sr, 'bp', 400, 2), br = new Biquad(sr, 'bp', 400, 2);
    let ph = 0;
    for (let i = 0; i < N; i++) {
      const tt = i / sr, p = tt / dur;
      if (i % 64 === 0) { const f = 400 * Math.pow(7000 / 400, p); bl.set(f); br.set(f * 1.1); }
      ph += 110 * Math.pow(8, p) / sr;
      const e = Math.pow(p, 2), saw = ((ph % 1) * 2 - 1) * 0.15;
      L[i] = (bl.tick(D.nz(i + 7777)) + saw) * e; R[i] = (br.tick(D.nz(i + 17777)) + saw) * e;
    }
    D.add2('sfx', t, L, R, v * 0.55, 0.4);
  },
};

// ---- Master ------------------------------------------------------------------
/** Freeverb-style stereo reverb on a send bus. */
export function reverb(sr, inL, inR, mix = 0.3, room = 0.82, damp = 0.35) {
  const scale = sr / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * scale));
  const alls = [556, 441, 341, 225].map((x) => Math.round(x * scale));
  const run = (inp, spread) => {
    const out = new Float32Array(inp.length);
    const cb = combs.map((c) => ({ b: new Float32Array(c + spread), i: 0, f: 0 }));
    const ab = alls.map((a) => ({ b: new Float32Array(a + spread), i: 0 }));
    for (let n = 0; n < inp.length; n++) {
      const x = inp[n] * 0.015; let s = 0;
      for (const c of cb) { const y = c.b[c.i]; c.f = y * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * room; c.i = (c.i + 1) % c.b.length; s += y; }
      for (const a of ab) { const y = a.b[a.i]; const o = -s + y; a.b[a.i] = s + y * 0.5; a.i = (a.i + 1) % a.b.length; s = o; }
      out[n] = s * mix;
    }
    return out;
  };
  return [run(inL, 0), run(inR, Math.round(23 * scale))];
}

/** Master tilt EQ: rumble cut, gentle low trim, presence and air lift. In place. */
export function tilt(sr, L, R) {
  for (const X of [L, R]) {
    const f = [new Biquad(sr, 'hp', 32, 0.7), new Biquad(sr, 'peak', 50, 0.9, -5), new Biquad(sr, 'peak', 3200, 0.7, 2.5), new Biquad(sr, 'peak', 10000, 0.6, 0.5)];
    for (let i = 0; i < X.length; i++) { let v = X[i]; for (const b of f) v = b.tick(v); X[i] = v; }
  }
}

/** Feed-forward compressor + lookahead peak limiter + soft clip. In place. */
export function master(sr, L, R, o = {}) {
  const thr = Math.pow(10, (o.threshold ?? -16) / 20), ratio = o.ratio ?? 2.5;
  const atkC = Math.exp(-1 / (sr * 0.01)), relC = Math.exp(-1 / (sr * 0.15));
  let env = 0;
  for (let i = 0; i < L.length; i++) {
    const x = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    env = x > env ? atkC * env + (1 - atkC) * x : relC * env + (1 - relC) * x;
    const g = env > thr ? Math.pow(env / thr, 1 / ratio - 1) : 1;
    L[i] *= g; R[i] *= g;
  }
  // Lookahead limiter at ceiling
  const ceil = Math.pow(10, (o.ceiling ?? -1) / 20), la = Math.round(sr * 0.003), rel = Math.exp(-1 / (sr * 0.08));
  const gainArr = new Float32Array(L.length);
  let gcur = 1;
  // Required gain per sample, then a running minimum over the lookahead window.
  const req = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); req[i] = p > ceil ? ceil / p : 1; }
  for (let i = L.length - 1; i >= 0; i--) { let m = req[i]; for (let k = 1; k <= la && i + k < L.length; k += 16) m = Math.min(m, req[i + k]); req[i] = m; }
  for (let i = 0; i < L.length; i++) { gcur = req[i] < gcur ? req[i] : rel * gcur + (1 - rel) * req[i]; gainArr[i] = gcur; }
  for (let i = 0; i < L.length; i++) {
    L[i] = Math.tanh(L[i] * gainArr[i] * 1.05) / Math.tanh(1.05);
    R[i] = Math.tanh(R[i] * gainArr[i] * 1.05) / Math.tanh(1.05);
  }
}
