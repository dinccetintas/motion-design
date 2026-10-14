// Score rendering in Node: plan the film, compose the music, write a WAV.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { plan, planCues } from '../engine/film.js';
import { composeScore, wavBytes } from '../engine/audio/score.js';

export function composeForSpec(spec) {
  const P = plan(spec);
  return { P, mix: composeScore(P.spec, planCues(P), P.duration) };
}

/** Compose and write the raw (un-normalized) score WAV. Returns { path, duration, beat }. */
export async function renderScoreFile(spec, out) {
  const { P, mix } = composeForSpec(spec);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, wavBytes(mix));
  return { path: out, duration: P.duration, beat: P.beat };
}
