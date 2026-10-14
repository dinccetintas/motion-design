// node scripts/audio.mjs films/x.json out/x.wav [--mood chill]
// Composes the score in Node (pure JS DSP), normalizes to -14 LUFS, reports loudness.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { renderScoreFile } from '../server/audio.js';
import { loudness, normalizeAudio } from '../server/renderer.js';
const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null; };
const spec = JSON.parse(readFileSync(a[0], 'utf8'));
if (opt('mood')) { spec.music = { ...(spec.music || {}), mood: opt('mood') }; delete spec.music.bpm; }
const out = a[1] || 'out/score.wav', t0 = Date.now();
const raw = out.replace('.wav', '.raw.wav');
await renderScoreFile(spec, raw);
console.log('composed', Date.now() - t0, 'ms', await loudness(raw));
await normalizeAudio(raw, out);
console.log('normalized', await loudness(out));
