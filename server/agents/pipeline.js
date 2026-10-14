// The agent team. A brief becomes a film through Researcher -> Writer -> Art Director ->
// Director -> Critic (measured QA + vision review) -> revisions until every score is 8+.
// Each step streams events so the studio UI can show the team at work.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classify, ingestUrl, ingestText } from '../ingest.js';
import { hasLLM, callJSON } from '../llm.js';
import { filmSchema, repair } from '../../engine/schema.js';
import { analyze } from '../qa.js';
import * as store from '../store.js';
import * as P from './prompts.js';
import * as off from './offline.js';

const obj = (properties, required) => ({ type: 'object', properties, required: required || Object.keys(properties), additionalProperties: false });
const S = { type: 'string' }, A = (items) => ({ type: 'array', items });
const DOSSIER = obj({ subject: S, audience: S, promise: S, tone: S, proof: A(S), numbers: A(obj({ value: S, meaning: S, source: S })), phrases: A(S), quotes: A(obj({ text: S, speaker: S })), cta: S, sources: A(S) });
const STORY = obj({ concept: S, hook: S, arc: A(obj({ purpose: S, copy: S })), tagline: S, cta: S });
const ART = obj({ style: S, mood: S, format: S, accentStyle: S, palette: obj({ dark: S, light: S, accent: S }), rationale: S });
const SCORE = { type: 'integer' };
const CRITIQUE = obj({ scores: obj({ hook: SCORE, readability: SCORE, motion: SCORE, variety: SCORE, brand: SCORE, sync: SCORE }), verdict: S, fixes: A(obj({ scene: { type: 'integer' }, problem: S, change: S })) });

const MAX_ROUNDS = 3;
const json = (x) => JSON.stringify(x, null, 1);

/** Assemble the renderable spec: assets as URLs, brand block, palette guard. */
function finalize(spec, project, raw) {
  const s = JSON.parse(JSON.stringify(spec));
  s.assets = Object.fromEntries(Object.entries(raw.assets || {}).map(([k, f]) => [k.replace(/\.\w+$/, ''), store.assetUrl(project.id, f)]));
  s.brand = { name: raw.name || s.title, url: raw.host || raw.url || '', colors: raw.brand?.colors?.all?.length ? raw.brand.colors.all : undefined, logo: raw.assets?.logo ? 'logo' : undefined, screenshot: raw.assets?.hero ? 'hero' : undefined };
  return s;
}

/**
 * Run the team on a message. mode: 'new' (fresh brief) or 'revise' (a note on the current cut).
 * emit({ agent, state: start|think|note|done|error, text, data })
 */
export async function run(project, message, emit) {
  const llm = hasLLM();
  const say = (agent, state, text, data) => emit({ agent, state, text, data, at: Date.now() });
  project.messages.push({ role: 'user', text: message, at: Date.now() });
  const revise = !!project.spec && !/^(new|start over|make a new)/i.test(message.trim());
  say('studio', 'note', llm ? `The full agent team is on it (${revise ? 'revision' : 'new film'}).` : 'Offline director: heuristic agents. Set ANTHROPIC_API_KEY on the server for the full Claude agent team.');

  let raw = project.raw, dossier = project.dossier, story = project.story, art = project.art, spec;
  if (!revise) {
    // ---- Researcher
    say('researcher', 'start', 'Reading the material');
    const c = classify(message);
    if (c.kind === 'url') {
      raw = await ingestUrl(c.url, join(store.dirOf(project.id), 'assets'), { onStatus: (t) => say('researcher', 'note', t) });
      say('researcher', 'note', `Captured ${raw.host}: ${Object.keys(raw.assets).join(', ')} • brand accent ${raw.brand.colors.accent || 'none (monochrome)'} • ${raw.numbers.length} numbers found`, { assets: Object.fromEntries(Object.entries(raw.assets).map(([k, f]) => [k, store.assetUrl(project.id, f)])), brand: raw.brand });
    } else raw = ingestText(c);
    raw.request = c.note || (c.kind === 'url' ? '' : message);
    if (llm) {
      const material = raw.kind === 'url'
        ? `Website: ${raw.url}\nName: ${raw.name}\nTitle: ${raw.title}\nDescription: ${raw.description}\nH1: ${json(raw.headings.h1)}\nH2: ${json(raw.headings.h2)}\nH3: ${json(raw.headings.h3)}\nCTAs: ${json(raw.ctas)}\nParagraphs:\n${raw.paragraphs.join('\n')}\nNumbers found: ${json(raw.numbers)}`
        : raw.kind === 'article' ? `Article:\n${raw.text}` : `Topic: ${raw.topic}`;
      dossier = await callJSON({ system: P.RESEARCHER, content: `${material}\n\nClient request: ${message}`, schema: DOSSIER, effort: 'medium',
        tools: raw.kind === 'topic' ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }] : undefined,
        onThink: (t) => say('researcher', 'think', t), onSearch: (q) => say('researcher', 'note', 'Searching the web' + (q ? `: ${q}` : '')) });
    } else dossier = off.dossierFrom(raw, message);
    say('researcher', 'done', `${dossier.subject}: ${dossier.promise}`, { dossier });

    // ---- Writer
    say('writer', 'start', 'Finding the story');
    if (llm) story = await callJSON({ system: P.WRITER, content: `Dossier:\n${json(dossier)}\n\nClient request: ${message}`, schema: STORY, effort: 'high', onThink: (t) => say('writer', 'think', t) });
    else story = { concept: `${dossier.subject}: ${off.short(dossier.promise || '', 10)}`, hook: off.accentize(off.short(dossier.promise || dossier.subject || '', 5)), arc: [], tagline: off.short(dossier.promise || '', 6), cta: dossier.cta || '' };
    say('writer', 'done', `Concept: ${story.concept}\nHook: ${story.hook}`, { story });

    // ---- Art director
    say('art', 'start', 'Choosing the look and the sound');
    if (llm) art = await callJSON({ system: P.ART_DIRECTOR, content: `Dossier:\n${json(dossier)}\nStory:\n${json(story)}\nBrand colors found: ${json(raw.brand?.colors || {})}\nBrand fonts: ${json(raw.brand?.fonts || {})}\nClient request: ${message}`, schema: ART, effort: 'medium', onThink: (t) => say('art', 'think', t) });
    else art = off.artFrom(dossier, raw, message);
    say('art', 'done', `${art.style} • ${art.mood} • ${art.format} • accent ${art.palette?.accent}\n${art.rationale}`, { art });
  }

  // ---- Director
  const assetKeys = Object.keys(raw.assets || {}).map((k) => k.replace(/\.\w+$/, ''));
  const schema = filmSchema({ assets: assetKeys.filter((k) => k !== 'logo' && k !== 'mobile').concat(assetKeys.includes('mobile') ? ['mobile'] : []), logo: assetKeys.includes('logo') ? 'logo' : null });
  say('director', 'start', revise ? 'Re-cutting with your note' : 'Blocking the film on the beat grid');
  const assetNote = assetKeys.length ? `Image assets available: ${assetKeys.join(', ')} (page = full-page desktop screenshot, hero = first screen, mobile = the site on a phone for the device scene, logo = brand logo).` : 'No image assets: do not use screen or image scenes.';
  const brief = `Dossier:\n${json(dossier)}\n\nStory:\n${json(story)}\n\nArt direction:\n${json(art)}\n\n${assetNote}\nURL: ${raw.host || 'none'}\n\nClient request: ${project.messages[0]?.text}`;
  if (revise) {
    if (llm) spec = await callJSON({ system: P.REVISE, content: `${brief}\n\nCurrent spec:\n${json(stripRuntime(project.spec))}\n\nClient's new note: ${message}`, schema, effort: 'high', onThink: (t) => say('director', 'think', t) });
    else spec = off.reviseSpec(stripRuntime(project.spec), null, message);
  } else if (llm) spec = await callJSON({ system: P.DIRECTOR, content: brief, schema, effort: 'high', onThink: (t) => say('director', 'think', t) });
  else spec = off.directFrom(dossier, art, raw, message);
  spec = guard(spec, assetKeys, say);
  say('director', 'done', `${spec.scenes.length} scenes • ${spec.style} • ${spec.music?.mood}`, { spec: finalize(spec, project, raw) });

  // ---- Critic loop: measure, look, fix. Until every score is 8+ or rounds run out.
  let qa = null, best = null;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const full = finalize(spec, project, raw);
    say('critic', 'start', `Review round ${round}: rendering a contact sheet and measuring the cut`);
    const sheetPath = join(store.dirOf(project.id), `sheet-${round}.png`);
    qa = await analyze(full, { sheet: sheetPath });
    if (!best || qa.overall > best.qa.overall) best = { spec, qa, round };
    say('critic', 'note', `Measured: ${Object.entries(qa.scores).map(([k, v]) => `${k} ${v}`).join(' • ')}`, { qa, sheet: store.assetUrl(project.id, '../' + `sheet-${round}.png`).replace('/assets/../', '/') });
    let critique;
    if (llm) {
      const img = readFileSync(sheetPath).toString('base64');
      critique = await callJSON({ system: P.CRITIC, schema: CRITIQUE, effort: 'medium', onThink: (t) => say('critic', 'think', t), content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } },
        { type: 'text', text: `Automated QA:\n${json({ scores: qa.scores, issues: qa.issues.slice(0, 25), metrics: qa.metrics })}\n\nSpec:\n${json(spec)}\n\nDossier:\n${json(dossier)}` },
      ] });
      // The film passes only when both the measurements and the reviewer agree.
      critique.scores = Object.fromEntries(Object.keys(qa.scores).map((k) => [k, Math.min(qa.scores[k], critique.scores[k] ?? 10)]));
    } else critique = off.critiqueFrom(qa);
    const pass = Object.values(critique.scores).every((v) => v >= 8);
    say('critic', 'done', `${pass ? 'Approved' : 'Notes'}: ${critique.verdict}${critique.fixes.length ? '\n' + critique.fixes.slice(0, 3).map((f) => `• Scene ${f.scene + 1}: ${f.problem} → ${f.change}`).join('\n') : ''}`, { critique, round });
    if (pass || round === MAX_ROUNDS || !critique.fixes.length) break;
    say('director', 'start', `Applying ${critique.fixes.length} notes`);
    const prev = spec;
    if (llm) spec = await callJSON({ system: P.REVISE, content: `${brief}\n\nCurrent spec:\n${json(spec)}\n\nCreative director's notes:\n${json(critique)}\n\nQA issues:\n${json(qa.issues.slice(0, 20))}`, schema, effort: 'high', onThink: (t) => say('director', 'think', t) });
    else spec = off.reviseSpec(spec, critique, '');
    spec = guard(spec, assetKeys, say);
    if (JSON.stringify(prev) === JSON.stringify(spec)) { say('director', 'done', 'No further changes to make.'); break; }
    say('director', 'done', 'Revised cut ready', { spec: finalize(spec, project, raw) });
  }
  // Keep the best-measured cut.
  if (best && best.qa.overall > qa.overall) { spec = best.spec; qa = best.qa; }

  const full = finalize(spec, project, raw);
  qa.sheet = `/data/projects/${project.id}/sheet-${best?.round || 1}.png`;
  Object.assign(project, { raw, dossier, story, art, spec: full, qa, title: spec.title || project.title });
  project.versions.push({ at: Date.now(), spec: full, qa: { scores: qa.scores, overall: qa.overall }, note: message });
  project.messages.push({ role: 'studio', text: summary(full, qa), at: Date.now() });
  store.save(project);
  say('studio', 'done', summary(full, qa), { spec: full, qa });
  return project;
}

const stripRuntime = (s) => { const x = JSON.parse(JSON.stringify(s)); delete x.assets; delete x.brand; return x; };

/** Repair model output so the renderer never sees an invalid spec. */
function guard(spec, assetKeys, say) {
  const { spec: s, problems } = repair(spec, { assets: assetKeys });
  if (problems.length) say('director', 'note', `Repaired: ${problems.slice(0, 4).join('; ')}`);
  if (!s.scenes.length) throw new Error('The director produced no usable scenes.');
  if (s.scenes.at(-1).type !== 'endcard') s.scenes.push({ type: 'endcard', beats: 6, ground: 'accent', transition: 'zoom', props: { name: s.title || 'Studio' } });
  return s;
}

function summary(spec, qa) {
  const dur = (spec.scenes.reduce((a, s) => a + (s.beats || 6), 0) * 60 / (spec.music?.bpm || 120)).toFixed(0);
  return `“${spec.title}”: ${spec.scenes.length} scenes, about ${dur}s, ${spec.format}. Scores ${Object.entries(qa.scores).map(([k, v]) => `${k} ${v}`).join(', ')}.`;
}
