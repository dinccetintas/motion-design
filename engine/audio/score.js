// The score: an original arrangement synthesized for each film, locked to its beat grid.
// Structure follows the film: a hit on frame 0, groove, a breakdown + riser before the
// drop, and an outro that rings out on the end card. Sound effects come from film cues.
import { Desk, kick, clap, snare, hat, rim, shaker, tom, bass, sub808, pad, pluck, keys, SFX, reverb, master, tilt } from './dsp.js';
import { rng } from '../core.js';

const CH = { M: [0, 4, 7], m: [0, 3, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], sus2: [0, 2, 7], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14] };
const chord = (s) => { const m = /^(-?\d+)(\w+)$/.exec(s); return { root: +m[1], tones: CH[m[2]] }; };

export const MOODS = {
  drive: { name: 'Drive', bpm: 120, keys: [57, 55, 52, 53], prog: ['0m', '-4M', '3M', '-2M'], drums: 'four', bassStyle: 'offbeat', lead: 'arp', padCut: 1800, desc: 'driving minor electro-pop, confident' },
  pulse: { name: 'Pulse', bpm: 124, keys: [57, 52, 50], prog: ['0m7', '-4M7', '0m7', '-2sus2'], drums: 'minimal', bassStyle: 'pulse', lead: 'stabs', padCut: 1200, desc: 'minimal tech pulse, focused, nocturnal' },
  cinematic: { name: 'Cinematic', bpm: 92, keys: [50, 52, 48], prog: ['0m', '-4M', '5m', '7M'], drums: 'epic', bassStyle: 'long', lead: 'slowarp', padCut: 2200, desc: 'epic trailer build with big hits' },
  chill: { name: 'Chill', bpm: 86, keys: [60, 62, 57], prog: ['5M7', '4m7', '9m7', '2m7'], drums: 'lofi', bassStyle: 'roots', lead: 'comp', padCut: 900, padGain: 0.7, desc: 'warm lo-fi, relaxed, human' },
  hype: { name: 'Hype', bpm: 140, keys: [53, 55, 51], prog: ['0m', '0m', '-4M', '-2M'], drums: 'trap', bassStyle: '808', lead: 'bell', padCut: 1800, padGain: 2, desc: 'hard trap energy, loud, bold' },
  bright: { name: 'Bright', bpm: 118, keys: [60, 62, 55], prog: ['0M', '7M', '9m', '5M'], drums: 'four', bassStyle: 'octave', lead: 'bellarp', padCut: 2400, desc: 'sunny upbeat pop, optimistic' },
  luxe: { name: 'Luxe', bpm: 96, keys: [53, 51, 56], prog: ['0M7', '9m7', '5M7', '7sus2'], drums: 'soft', bassStyle: 'long', lead: 'sparse', padCut: 1300, desc: 'elegant, airy, premium ambient' },
};
export const MOOD_NAMES = Object.keys(MOODS);

/**
 * Compose and mix the score. Returns { sr, L, R } Float32Arrays (pure JS, works in Node and browsers).
 */
export function composeScore(spec, cues, duration, sr = 48000) {
  const mood = MOODS[spec.music?.mood] || MOODS.drive;
  const bpm = spec.music?.bpm || mood.bpm, beat = 60 / bpm, bar = beat * 4;
  const seed = spec.music?.seed || 1, r = rng(seed * 31 + 7);
  const D = new Desk(sr, duration + 1.2, seed);
  const key = mood.keys[Math.floor(r() * mood.keys.length)];
  const prog = mood.prog.map(chord);
  const nBars = Math.ceil(duration / bar);
  // Arrangement: the outro is the last scene; a breakdown sits a bit past the middle.
  const scenes = spec.scenes || [];
  let acc = 0; const starts = scenes.map((s) => { const st = acc; acc += (s.beats || 4) * beat; return st; });
  const outroAt = scenes.length > 1 ? starts[starts.length - 1] : duration;
  const breakBar = nBars >= 10 ? Math.round(nBars * 0.55) : -1;
  const energyAt = (t) => {
    const b = Math.floor(t / bar);
    if (t >= outroAt) return 0;
    if (b === breakBar) return 0.3;
    if (b === 0) return 0.75;
    return 1;
  };

  // Hit on frame 0: the hook lands with sound.
  SFX.impact(D, 0.0, 0.9);
  if (breakBar > 0) { SFX.riser(D, breakBar * bar, 0.6, bar); SFX.impact(D, (breakBar + 1) * bar, 0.8); }
  if (outroAt < duration) SFX.impact(D, outroAt, 1.0);

  const kicks = [];
  const nBeats = Math.ceil(duration / beat);
  const swing = mood.drums === 'lofi' ? beat * 0.08 : 0;
  for (let i = 0; i < nBeats; i++) {
    const t = i * beat, e = energyAt(t), pos = i % 4, barIdx = Math.floor(i / 4);
    if (e <= 0) continue;
    const ofs = t + beat / 2 + swing;
    switch (mood.drums) {
      case 'four':
        if (e >= 0.75) { kick(D, t, 0.95); kicks.push(t); }
        if (e >= 1 && (pos === 1 || pos === 3)) clap(D, t, 0.55);
        if (e >= 0.75) hat(D, ofs, 0.7, pos === 3 && barIdx % 2 === 1);
        if (e >= 1) { hat(D, t + beat * 0.25, 0.12, false, -0.3); hat(D, t + beat * 0.75, 0.12, false, -0.3); }
        if (e > 0 && e < 0.75) hat(D, ofs, 0.35);
        break;
      case 'minimal':
        if (e >= 0.75) { kick(D, t, 0.9, { decay: 0.3 }); kicks.push(t); }
        if (e >= 1 && pos === 1) rim(D, t + beat * 0.5, 0.8);
        if (e >= 1 && pos === 3) rim(D, t + beat * 0.75, 0.6);
        for (let k = 0; k < 4; k++) if (e >= 0.75) hat(D, t + k * beat / 4, k === 2 ? 0.5 : 0.18, false, 0.35);
        break;
      case 'epic':
        if (pos === 0 && e >= 0.75) { tom(D, t, 0.9, 55); kick(D, t, 0.8, { decay: 0.7 }); kicks.push(t); }
        if (e >= 1 && pos === 2) { tom(D, t, 0.6, 80); snare(D, t, 0.6); }
        if (e >= 1 && pos === 3) { tom(D, t + beat * 0.5, 0.45, 70); tom(D, t + beat * 0.75, 0.5, 62); }
        if (e >= 1) shaker(D, ofs, 0.8);
        break;
      case 'lofi':
        if ((pos === 0 || (pos === 2 && barIdx % 2)) && e >= 0.75) { kick(D, t, 0.85, { decay: 0.35, top: 130 }); kicks.push(t); }
        if (pos === 2 && !(barIdx % 2) && e >= 0.75) kick(D, t + beat * 0.5 + swing, 0.6, { decay: 0.3, top: 130 });
        if (e >= 1 && (pos === 1 || pos === 3)) snare(D, t, 0.45);
        if (e >= 0.75) { shaker(D, t, 0.6); shaker(D, ofs, 0.9); }
        break;
      case 'trap':
        if (e >= 0.75 && (pos === 0 || (pos === 2 && barIdx % 2 === 1) || (pos === 1 && barIdx % 2 === 0))) { const tk = t + (pos === 1 ? beat * 0.5 : 0); kick(D, tk, 0.95, { decay: 0.25 }); kicks.push(tk); }
        if (e >= 1 && pos === 2) clap(D, t, 0.7);
        if (e >= 0.75) { const roll = pos === 3 && barIdx % 2 === 1, n = roll ? 6 : 2; for (let k = 0; k < n; k++) hat(D, t + k * beat / n, roll ? 0.35 : 0.5, false, 0.2); }
        break;
      case 'soft':
        if (pos === 0 && e >= 0.75) { kick(D, t, 0.7, { decay: 0.5, top: 110 }); kicks.push(t); }
        if (e >= 1 && pos === 2) rim(D, t, 0.5);
        if (e >= 1) shaker(D, ofs, 0.5);
        break;
    }
  }

  // Harmony, bass and lead.
  for (let b = 0; b < nBars; b++) {
    const t = b * bar, c = prog[b % prog.length], root = key + c.root;
    const notes = c.tones.map((x) => root + x);
    const outro = t >= outroAt, e = energyAt(t);
    const padLen = outro ? Math.min(bar * 2, duration - t + 0.8) : bar;
    pad(D, t, notes, padLen, (outro ? 1.2 : 1) * (mood.padGain || 1), { cut: mood.padCut, attack: b === 0 ? 0.02 : 0.25 });
    const bn = root - 24 + (root - 24 < 33 ? 12 : 0);
    if (!outro) {
      switch (mood.bassStyle) {
        case 'offbeat': for (let k = 0; k < 4; k++) if (e >= 0.75) { bass(D, t + k * beat, bn, beat * 0.2, 0.55); bass(D, t + k * beat + beat / 2, bn, beat * 0.45, 0.9); } break;
        case 'pulse': for (let k = 0; k < 8; k++) if (e >= 0.75 && k % 8 !== 3) bass(D, t + k * beat / 2, bn, beat * 0.3, k % 2 ? 0.55 : 0.85, { cut: 500 }); break;
        case 'long': bass(D, t, bn, bar * 0.95, 0.9, { wave: 'triangle', cut: 400 }); break;
        case 'roots': bass(D, t, bn, beat * 1.4, 0.85, { wave: 'sine', cut: 600 }); bass(D, t + beat * 2.5 + swing, bn + 7, beat * 1.2, 0.6, { wave: 'sine', cut: 600 }); break;
        case '808': sub808(D, t, bn, beat * 1.8, 1); sub808(D, t + beat * 2.5, bn + (b % 2 ? 3 : 0), beat * 1.3, 0.9, bn + 12); break;
        case 'octave': for (let k = 0; k < 8; k++) if (e >= 0.75) bass(D, t + k * beat / 2, bn + (k % 2 ? 12 : 0), beat * 0.4, 0.8, { cut: 700 }); break;
      }
    } else if (t < duration) bass(D, t, bn, Math.min(bar * 2, duration - t + 0.6), 0.9, { wave: 'triangle', cut: 300 });
    const up = [...notes, notes[0] + 12, notes[1] + 12];
    if (outro) { if (b === Math.floor(outroAt / bar)) keys(D, Math.max(t, outroAt), notes[0] + 12, bar, 0.9, { ratio: 3.5, index: 3 }); continue; }
    switch (mood.lead) {
      case 'arp': if (e >= 0.75) for (let k = 0; k < 16; k++) pluck(D, t + k * beat / 4, up[(k * 3) % up.length] + 12, k % 4 === 0 ? 1 : 0.6, { pan: k % 2 ? 0.3 : -0.3, decay: 0.18 }); break;
      case 'stabs': for (const k of [1.5, 3, 3.75]) { keys(D, t + k * beat, notes[0] + 12, beat * 0.3, 0.6, { ratio: 1, index: 1.5, bright: 0.2 }); keys(D, t + k * beat, notes[2] + 12, beat * 0.3, 0.5, { ratio: 1, index: 1.5, bright: 0.2 }); } break;
      case 'slowarp': for (let k = 0; k < 8; k++) keys(D, t + k * beat / 2, up[k % up.length] + 12, beat, k === 0 ? 0.8 : 0.5, { ratio: 2, index: 1.2, pan: (k % 3 - 1) * 0.4 }); break;
      case 'comp': for (const k of [0, 1.5 + swing / beat, 2.75]) notes.forEach((n, j) => keys(D, t + k * beat + j * 0.012, n + 12, beat * 0.9, 0.22, { ratio: 1, index: 1.2, bright: 0.4 })); break;
      case 'bell': if (e >= 0.75) [0, 0.75, 1.5, 2.5, 3].forEach((k, j) => keys(D, t + k * beat, up[(j * 2 + b) % up.length] + 24, beat * 0.6, 0.55, { ratio: 3.5, index: 2.5 })); break;
      case 'bellarp': if (e >= 0.75) for (let k = 0; k < 8; k++) keys(D, t + k * beat / 2, up[(k * 2) % up.length] + 12, beat * 0.4, k % 2 ? 0.22 : 0.32, { ratio: 3.5, index: 2, pan: k % 2 ? 0.35 : -0.35 }); break;
      case 'sparse': if (b % 2 === 0) [0, 1.5, 3].forEach((k, j) => keys(D, t + k * beat, up[j + 1] + 12, beat * 2, 0.5, { ratio: 1, index: 0.9, pan: (j - 1) * 0.3 })); break;
    }
  }

  // Film cues: every visual event gets its sound, on the grid it was animated to.
  for (const c of cues) { const fn = SFX[c.sfx]; if (fn) fn(D, c.t, c.gain ?? 0.5, c.dur); }

  // Sidechain pump on music, then sum buses.
  const n = D.n, duckG = new Float32Array(n).fill(1);
  const depth = mood.drums === 'four' || mood.drums === 'minimal' ? 0.5 : 0.28;
  for (const t of kicks) {
    const s0 = Math.round(t * sr), rel = Math.round(beat * 0.55 * sr);
    for (let i = 0; i < rel && s0 + i < n; i++) { const p = i / rel; duckG[s0 + i] = Math.min(duckG[s0 + i], 1 - depth * Math.pow(1 - p, 1.6)); }
  }
  const [RL, RR] = reverb(sr, D.bus.send[0], D.bus.send[1], 0.9);
  const L = new Float32Array(n), R = new Float32Array(n);
  const { music, drums, sfx } = D.bus;
  for (let i = 0; i < n; i++) {
    L[i] = music[0][i] * 0.8 * duckG[i] + drums[0][i] * 0.9 + sfx[0][i] * 0.8 + RL[i];
    R[i] = music[1][i] * 0.8 * duckG[i] + drums[1][i] * 0.9 + sfx[1][i] * 0.8 + RR[i];
  }
  // Fade the tail after the last frame.
  const f0 = Math.round(duration * sr);
  for (let i = f0; i < n; i++) { const g = Math.max(0, 1 - (i - f0) / (sr * 1.1)); L[i] *= g; R[i] *= g; }
  tilt(sr, L, R);
  master(sr, L, R, { threshold: -16, ratio: 2.5, ceiling: -1 });
  return { sr, L, R };
}

/** Browser: an AudioBuffer for live preview. */
export function scoreToAudioBuffer(ac, mix) {
  const b = ac.createBuffer(2, mix.L.length, mix.sr);
  b.copyToChannel(mix.L, 0); b.copyToChannel(mix.R, 1);
  return b;
}

/** 16-bit PCM WAV bytes. */
export function wavBytes(mix) {
  const ch = 2, n = mix.L.length, sr = mix.sr;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = [mix.L, mix.R];
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Uint8Array(out.buffer);
}

/** Render the score and return base64 WAV (for the headless renderer). */
export async function renderScore(spec, cues, duration) {
  const bytes = wavBytes(composeScore(spec, cues, duration));
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
