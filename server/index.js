// Studio server: static site + JSON API + Server-Sent Events for live agent activity.
// node server/index.js  ->  http://localhost:4100
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic, ROOT } from './static.js';
import * as store from './store.js';
import { run } from './agents/pipeline.js';
import { renderVideo, contactSheet } from './renderer.js';
import { hasLLM, MODEL } from './llm.js';
import { catalog } from '../engine/scenes/index.js';
import { STYLES } from '../engine/styles.js';
import { MOODS } from '../engine/audio/score.js';
import { TRANSITION_NAMES } from '../engine/transitions.js';
import { repair } from '../engine/schema.js';
import { analyze } from './qa.js';

const PORT = +process.env.PORT || 4100;
const jobs = new Map();          // project id -> { events: [], subs: Set<res>, busy: false }
const renderQueue = [];          // serialized: rendering saturates every core
let rendering = false;

const job = (id) => { if (!jobs.has(id)) jobs.set(id, { events: [], subs: new Set(), busy: false }); return jobs.get(id); };
function emit(id, ev) {
  const j = job(id);
  if (ev.state !== 'think') j.events.push(ev);
  else { // thinking deltas are coalesced so a reconnecting client replays a readable log
    const last = j.events.at(-1);
    if (last && last.state === 'think' && last.agent === ev.agent) last.text += ev.text; else j.events.push({ ...ev });
  }
  if (j.events.length > 600) j.events.splice(0, j.events.length - 600);
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const res of j.subs) res.write(line);
}

const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
async function body(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 2e6) throw new Error('body too large'); }
  return s ? JSON.parse(s) : {};
}

function startRun(p, message) {
  const j = job(p.id);
  if (j.busy) return false;
  j.busy = true;
  j.events = [];
  emit(p.id, { agent: 'studio', state: 'start', text: message, at: Date.now() });
  run(p, message, (ev) => emit(p.id, ev))
    .catch((e) => { console.error(e); emit(p.id, { agent: 'studio', state: 'error', text: friendly(e), at: Date.now() }); })
    .finally(() => { j.busy = false; emit(p.id, { agent: 'studio', state: 'idle', at: Date.now() }); });
  return true;
}
const friendly = (e) => /net::|ERR_|Timeout|timeout/.test(e.message) ? `Could not load that page (${e.message.split('\n')[0].slice(0, 120)}). Check the URL or paste the text instead.` : e.message.slice(0, 300);

function queueRender(p, quality) {
  const id = p.id;
  emit(id, { agent: 'render', state: 'start', text: `Queued ${quality} render`, at: Date.now() });
  renderQueue.push({ id, quality });
  pump();
}
async function pump() {
  if (rendering || !renderQueue.length) return;
  rendering = true;
  const { id, quality } = renderQueue.shift();
  try {
    const p = store.load(id);
    const dir = join(store.dirOf(id), 'renders');
    mkdirSync(dir, { recursive: true });
    const name = `${(p.title || 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${p.spec.format.replace(':', 'x')}-${quality}-${Date.now().toString(36)}.mp4`;
    const opts = quality === 'master' ? { fps: 60, sub: 4, workers: 3 } : { fps: 30, sub: 2, workers: 3, preset: 'veryfast' };
    let last = -1;
    const r = await renderVideo(p.spec, join(dir, name), { ...opts, onProgress: (f, label) => {
      const pc = Math.floor(f * 100);
      if (pc !== last) { last = pc; emit(id, { agent: 'render', state: 'progress', text: label, data: { progress: f }, at: Date.now() }); }
    } });
    const poster = join(dir, name.replace('.mp4', '.png'));
    await contactSheet(p.spec, poster, { times: [Math.min(1.2, r.info.duration / 2)], cols: 1, scale: 0.5 });
    const fresh = store.load(id);
    const entry = { file: `/data/projects/${id}/renders/${name}`, poster: `/data/projects/${id}/renders/${name.replace('.mp4', '.png')}`, quality, format: p.spec.format, duration: r.info.duration, loudness: r.loudness, at: Date.now() };
    fresh.renders.unshift(entry);
    fresh.thumb = entry.poster;
    store.save(fresh);
    emit(id, { agent: 'render', state: 'done', text: `Rendered ${quality} • ${r.info.duration.toFixed(1)}s • ${r.loudness?.lufs ?? '?'} LUFS`, data: entry, at: Date.now() });
  } catch (e) {
    console.error(e);
    emit(id, { agent: 'render', state: 'error', text: e.message.slice(0, 300), at: Date.now() });
  } finally { rendering = false; pump(); }
}

function showcase() {
  const dir = join(ROOT, 'public', 'showcase');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const meta = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    return { id: f.replace('.json', ''), ...meta };
  }).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

const routes = [
  ['GET', /^\/api\/health$/, (req, res) => send(res, 200, { ok: true, llm: hasLLM(), model: hasLLM() ? MODEL : 'offline director', rendering, queue: renderQueue.length })],
  ['GET', /^\/api\/catalog$/, (req, res) => send(res, 200, {
    scenes: catalog(), transitions: TRANSITION_NAMES,
    styles: Object.entries(STYLES).map(([id, s]) => ({ id, name: s.name, mood: s.mood, palette: s.palette, display: s.fonts.display.family, text: s.fonts.text.family })),
    moods: Object.entries(MOODS).map(([id, m]) => ({ id, name: m.name, bpm: m.bpm, desc: m.desc })),
  })],
  ['GET', /^\/api\/showcase$/, (req, res) => send(res, 200, showcase())],
  ['GET', /^\/api\/projects$/, (req, res) => send(res, 200, store.list())],
  ['POST', /^\/api\/projects$/, async (req, res) => {
    const b = await body(req);
    if (b.showcase) { // Remix: start a project from a published showcase film.
      const f = showcase().find((x) => x.id === b.showcase);
      if (!f) return send(res, 404, { error: 'No such showcase film.' });
      const p = store.create({ title: f.title, spec: f.spec, qa: { scores: f.qa.scores, overall: f.qa.overall, issues: [] }, messages: [{ role: 'studio', text: `Remixing “${f.title}”. Tell the crew what to change.`, at: Date.now() }] });
      p.versions.push({ at: Date.now(), spec: f.spec, qa: f.qa, note: 'Remixed from the showreel' });
      store.save(p);
      return send(res, 201, { id: p.id });
    }
    const msg = String(b.message || '').trim();
    if (!msg) return send(res, 400, { error: 'Tell the studio what the film is about: a URL, an article, or a topic.' });
    const p = store.create({ title: msg.slice(0, 60) });
    startRun(p, msg);
    send(res, 201, { id: p.id });
  }],
  ['GET', /^\/api\/projects\/([\w-]+)$/, (req, res, id) => { const p = store.load(id); p ? send(res, 200, { ...p, busy: job(id).busy }) : send(res, 404, { error: 'not found' }); }],
  ['POST', /^\/api\/projects\/([\w-]+)\/messages$/, async (req, res, id) => {
    const p = store.load(id); if (!p) return send(res, 404, { error: 'not found' });
    const msg = String((await body(req)).message || '').trim();
    if (!msg) return send(res, 400, { error: 'Empty message.' });
    if (!startRun(p, msg)) return send(res, 409, { error: 'The team is still working on the last request.' });
    send(res, 202, { ok: true });
  }],
  ['PUT', /^\/api\/projects\/([\w-]+)\/spec$/, async (req, res, id) => {
    const p = store.load(id); if (!p) return send(res, 404, { error: 'not found' });
    const b = await body(req);
    const assets = Object.keys(b.spec?.assets || p.spec?.assets || {});
    const { spec, problems } = repair(b.spec, { assets });
    if (!spec.scenes.length) return send(res, 400, { error: 'Spec has no valid scenes.', problems });
    p.spec = { ...spec, assets: p.spec?.assets, brand: p.spec?.brand };
    p.versions.push({ at: Date.now(), spec: p.spec, note: b.note || 'Edited in the studio' });
    store.save(p);
    send(res, 200, { ok: true, problems });
  }],
  ['POST', /^\/api\/projects\/([\w-]+)\/review$/, async (req, res, id) => {
    const p = store.load(id); if (!p?.spec) return send(res, 404, { error: 'Nothing to review yet.' });
    const n = (p.reviews || 0) + 1;
    const qa = await analyze(p.spec, { sheet: join(store.dirOf(id), `review-${n}.png`) });
    p.qa = { ...qa, sheet: `/data/projects/${id}/review-${n}.png` }; p.reviews = n;
    store.save(p);
    send(res, 200, p.qa);
  }],
  ['POST', /^\/api\/projects\/([\w-]+)\/render$/, async (req, res, id) => {
    const p = store.load(id); if (!p?.spec) return send(res, 404, { error: 'Nothing to render yet.' });
    const q = (await body(req)).quality === 'master' ? 'master' : 'draft';
    queueRender(p, q);
    send(res, 202, { ok: true, position: renderQueue.length });
  }],
  ['GET', /^\/api\/projects\/([\w-]+)\/events$/, (req, res, id) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const j = job(id);
    for (const ev of j.events) res.write(`data: ${JSON.stringify({ ...ev, replay: true })}\n\n`);
    j.subs.add(res);
    const ka = setInterval(() => res.write(': ka\n\n'), 15000);
    req.on('close', () => { clearInterval(ka); j.subs.delete(res); });
  }],
];

const server = createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0];
    for (const [m, re, fn] of routes) {
      const hit = req.method === m && re.exec(path);
      if (hit) return await fn(req, res, ...hit.slice(1));
    }
    if (path.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Motion studio on http://localhost:${PORT}  (${hasLLM() ? 'agents: ' + MODEL : 'offline director: set ANTHROPIC_API_KEY for the agent team'})`));
