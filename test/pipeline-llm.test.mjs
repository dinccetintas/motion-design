// The Claude-backed agent path, exercised with a fake client that speaks the SDK's streaming
// interface. Verifies request shape (adaptive thinking, structured output, refusal fallback),
// the thinking stream reaching the UI, and that a full run yields a valid, measured film.
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.ANTHROPIC_API_KEY = 'test-key';
const { setClient } = await import('../server/llm.js');
const P = await import('../server/agents/prompts.js');
const { run } = await import('../server/agents/pipeline.js');
const store = await import('../server/store.js');
const { closeBrowser } = await import('../server/renderer.js');

const calls = [], created = [];
const { rmSync } = await import('node:fs');
const SPEC = {
  title: 'Sleep, measured', concept: 'Every scene is one night of sleep.', format: '9:16', style: 'pastel', accentStyle: 'color',
  palette: { dark: '#1A1433', light: '#EEE9FF', accent: '#7C5CFF' }, music: { mood: 'chill', seed: 3 },
  scenes: [
    { type: 'title', beats: 4, ground: 'dark', transition: 'cut', props: { text: 'Sleep is *training*' } },
    { type: 'counter', beats: 6, ground: 'light', transition: 'panel', props: { value: 7, suffix: 'h', label: 'what most adults *need*' } },
    { type: 'stack', beats: 6, ground: 'dark', transition: 'slice', props: { items: ['Memory', '*Mood*', 'Muscle'] } },
    { type: 'endcard', beats: 6, ground: 'accent', transition: 'zoom', props: { name: 'Sleep', tagline: 'Rest is part of the work' } },
  ],
};
function respond(system) {
  if (system === P.RESEARCHER) return { subject: 'Sleep', audience: 'adults', promise: 'Sleep trains the brain', tone: 'calm', proof: ['Memory consolidates during sleep'], numbers: [{ value: '7h', meaning: 'adults need at least 7 hours', source: 'cdc.gov' }], phrases: [], quotes: [], cta: '', sources: ['cdc.gov'] };
  if (system === P.WRITER) return { concept: 'Every scene is one night of sleep.', hook: 'Sleep is *training*', arc: [{ purpose: 'hook', copy: 'Sleep is training' }], tagline: 'Rest is part of the work', cta: '' };
  if (system === P.ART_DIRECTOR) return { style: 'pastel', mood: 'chill', format: '9:16', accentStyle: 'color', palette: SPEC.palette, rationale: 'calm' };
  if (system === P.DIRECTOR || system === P.REVISE) return SPEC;
  if (system === P.CRITIC) return { scores: { hook: 9, readability: 9, motion: 9, variety: 9, brand: 9, sync: 9 }, verdict: 'Ready.', fixes: [] };
  throw new Error('unknown agent');
}
setClient({ beta: { messages: { stream(params) {
  calls.push(params);
  const out = respond(params.system[0].text);
  const events = [{ type: 'content_block_start', content_block: { type: 'thinking' } }, { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Considering the brief. ' } }];
  return { async *[Symbol.asyncIterator]() { yield* events; }, finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] }) };
} } } });

test('a topic brief runs the whole Claude crew and produces a measured film', { timeout: 120000 }, async () => {
  const p = store.create(); created.push(p.id);
  const events = [];
  await run(p, 'Why sleep matters', (e) => events.push(e));
  // Request shape for every agent call
  for (const c of calls) {
    assert.equal(c.model, 'claude-opus-5-5');
    assert.deepEqual(c.thinking, { type: 'adaptive', display: 'summarized' });
    assert.ok(c.output_config.format?.type === 'json_schema', 'structured output');
    assert.deepEqual(c.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(c.fallbacks, 'default');
  }
  const research = calls.find((c) => c.system[0].text === P.RESEARCHER);
  assert.ok(research.tools?.some((t) => t.type === 'web_search_20260209'), 'topic research uses web search');
  const critic = calls.find((c) => c.system[0].text === P.CRITIC);
  assert.equal(critic.messages[0].content[0].type, 'image', 'critic sees the contact sheet');
  // The UI receives the agents' thinking.
  assert.ok(events.some((e) => e.state === 'think' && e.agent === 'director'));
  // A valid film came out, measured.
  assert.equal(p.spec.scenes.length, 4);
  assert.ok(p.qa.overall > 0);
  assert.ok(events.some((e) => e.agent === 'studio' && e.state === 'done'));
});

test.after(async () => { await closeBrowser(); for (const id of created) rmSync(store.dirOf(id), { recursive: true, force: true }); });
