// Deterministic core: springs, rich text, timeline planning, schema repair, the score.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spring, track, hash, contrast } from '../engine/core.js';
import { parseRich } from '../engine/gfx.js';
import { plan, planCues, normalize } from '../engine/film.js';
import { repair, filmSchema } from '../engine/schema.js';
import { composeScore } from '../engine/audio/score.js';
import { resolveStyle, STYLES } from '../engine/styles.js';

test('springs settle and are pure functions of time', () => {
  assert.equal(spring(0), 0);
  assert.ok(Math.abs(spring(3) - 1) < 1e-3);
  assert.equal(spring(0.37), spring(0.37));
  assert.ok(Math.abs(track(5, [[0, 0], [1, 10], [2, 4]]) - 4) < 1e-2);
  assert.equal(hash(42, 1), hash(42, 1));
});

test('rich text: accent markup and punctuation stay with their word', () => {
  assert.deepEqual(parseRich('Not even *light*.').map((w) => [w.text, w.accent]), [['Not', false], ['even', false], ['light.', true]]);
  assert.deepEqual(parseRich('*two words* here').map((w) => w.accent), [true, true, false]);
});

test('plan: scenes land on whole beats and cues stay inside the film', () => {
  const P = plan({ music: { mood: 'drive' }, scenes: [{ type: 'title', beats: 4, props: { text: 'Hi' } }, { type: 'statement', beats: 6, transition: 'panel', props: { text: 'One two three four five six' } }] });
  assert.equal(P.beat, 0.5);
  assert.equal(P.scenes[1].start, 2);
  assert.equal(P.duration, 5);
  for (const c of planCues(P)) assert.ok(c.t >= 0 && c.t < P.duration);
});

test('normalize drops unknown scenes and forces a cut on scene one', () => {
  const s = normalize({ scenes: [{ type: 'nope' }, { type: 'title', transition: 'wipe', props: { text: 'x' } }] });
  assert.equal(s.scenes.length, 1);
  assert.equal(s.scenes[0].transition.type, 'cut');
});

test('schema repair removes scenes that cannot render', () => {
  const { spec, problems } = repair({ scenes: [{ type: 'screen', props: { image: 'missing' } }, { type: 'counter', props: {} }, { type: 'title', props: { text: 'ok' } }] });
  assert.equal(spec.scenes.length, 1);
  assert.equal(problems.length, 2);
  const schema = filmSchema({ assets: [] });
  const types = schema.properties.scenes.items.anyOf.map((v) => v.properties.type.const);
  assert.ok(!types.includes('screen'), 'no screen scenes without screenshots');
});

test('every style keeps text readable on every ground', () => {
  for (const id of Object.keys(STYLES)) {
    const st = resolveStyle(id);
    for (const g of ['dark', 'light', 'accent']) assert.ok(contrast(st.grounds[g].ink, st.grounds[g].bg) >= 4.5, `${id}/${g}`);
  }
  // A brand palette with weak grounds is pushed apart.
  const st = resolveStyle('swiss', { palette: { dark: '#555555', light: '#777777', accent: '#ff0000' } });
  assert.ok(contrast(st.grounds.dark.ink, st.grounds.dark.bg) >= 4.5);
});

test('the score is deterministic and the right length', () => {
  const spec = normalize({ music: { mood: 'pulse', seed: 5 }, scenes: [{ type: 'title', beats: 4, props: { text: 'x' } }] });
  const a = composeScore(spec, [], 2, 16000), b = composeScore(spec, [], 2, 16000);
  assert.equal(a.L.length, b.L.length);
  let diff = 0; for (let i = 0; i < a.L.length; i += 97) diff += Math.abs(a.L[i] - b.L[i]);
  assert.equal(diff, 0);
  assert.ok(a.L.length >= 2 * 16000);
  let peak = 0; for (const v of a.L) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak > 0.05 && peak <= 1, 'audible and not clipping');
});
