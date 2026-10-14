// Composes a film's score off the main thread (pure-JS DSP, same code as the renderer).
import { plan, planCues } from '/engine/film.js';
import { composeScore } from '/engine/audio/score.js';

self.onmessage = (e) => {
  const { id, spec } = e.data;
  try {
    const P = plan(spec);
    const mix = composeScore(P.spec, planCues(P), P.duration, 44100);
    self.postMessage({ id, sr: mix.sr, L: mix.L, R: mix.R }, [mix.L.buffer, mix.R.buffer]);
  } catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
