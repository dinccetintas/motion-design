// Studio controller: one project, its crew log, the live preview, the rail and the inspector.
import { Player, timecode } from '/js/player.js';
import { Rail } from '/js/rail.js';
import { sceneForm, filmForm, reviewPane, takesPane, lightbox } from '/js/inspector.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WHO = { researcher: 'Researcher', writer: 'Writer', art: 'Art director', director: 'Director', critic: 'Critic', studio: 'Studio', render: 'Render', composer: 'Composer' };
const NEW_CHIPS = [['Topic', 'How black holes bend time, cinematic, 16:9'], ['Link', 'https://en.wikipedia.org/wiki/Bauhaus'], ['Brief', 'A 20-second launch film for a coffee subscription that roasts to order, energetic']];
const EDIT_CHIPS = ['Make it 16:9', 'More energetic', 'Shorter', 'Calmer music', 'Darker'];

const S = { id: null, project: null, spec: null, qa: null, busy: false, sel: 0, catalog: null, es: null };
const app = $('#app');
const player = new Player($('#film'), { audio: true, loop: true, scale: 0.75 });
const rail = new Rail($('#rail'));

// ---- API ------------------------------------------------------------------------------------
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}

// ---- Boot -----------------------------------------------------------------------------------
async function boot() {
  const [health, catalog] = await Promise.all([api('/api/health').catch(() => ({})), api('/api/catalog').catch(() => ({ moods: [] }))]);
  S.catalog = catalog;
  $('#engine-mode').textContent = health.llm ? health.model : 'offline director';
  $('#engine-mode').title = health.llm ? 'The full agent team runs on Claude.' : 'Set ANTHROPIC_API_KEY on the server for the full agent team.';
  const q = new URLSearchParams(location.search);
  if (q.get('showcase')) { const { id } = await api('/api/projects', { method: 'POST', body: JSON.stringify({ showcase: q.get('showcase') }) }); history.replaceState(null, '', `/studio#${id}`); }
  else if (q.get('brief')) { const { id } = await api('/api/projects', { method: 'POST', body: JSON.stringify({ message: q.get('brief') }) }); history.replaceState(null, '', `/studio#${id}`); }
  await route();
}
window.addEventListener('hashchange', route);

async function route() {
  const id = location.hash.slice(1);
  S.es?.close();
  if (!id) return showEmpty();
  try { S.project = await api(`/api/projects/${id}`); }
  catch { history.replaceState(null, '', '/studio'); return showEmpty(); }
  S.id = id;
  app.dataset.state = 'film';
  $('#film-title').textContent = S.project.title || 'Untitled film';
  document.title = `${S.project.title || 'Film'} — Flatbed`;
  renderHistory();
  chips($('#chips'), EDIT_CHIPS.map((c) => [c, c]), $('#msg'));
  $('#msg').placeholder = 'Tell the crew what to change';
  if (S.project.spec) await setSpec(S.project.spec, { save: false });
  S.qa = S.project.qa || null;
  refreshPanes();
  setBusy(!!S.project.busy);
  if (!S.project.spec) waitScreen(true, 'The crew is working');
  connect();
}

async function showEmpty() {
  app.dataset.state = 'empty'; S.id = null; S.project = null; S.spec = null;
  $('#film-title').textContent = 'New film';
  $('#log').innerHTML = crewRoster();
  chips($('#empty-chips'), NEW_CHIPS, $('#empty-msg'));
  chips($('#chips'), NEW_CHIPS, $('#msg'));
  $('#msg').placeholder = 'Paste a link, an article or a topic';
  const list = await api('/api/projects').catch(() => []);
  if (list.length) {
    $('#recent').hidden = false;
    $('#recent-list').innerHTML = list.slice(0, 9).map((p) => `<li><a href="/studio#${p.id}">${p.thumb ? `<img src="${p.thumb}" alt="">` : '<span class="ph"></span>'}<span><span class="t">${esc(p.title)}</span><span class="s">${p.format || ''}${p.overall ? ' • ' + p.overall.toFixed(1) : ''}</span></span></a></li>`).join('');
  }
  $('#empty-msg').focus();
}
const crewRoster = () => ['researcher', 'writer', 'art', 'director', 'critic'].map((k) => `<li class="entry"><span class="mark note"></span><div><span class="who">${WHO[k]}</span><p class="what">${{ researcher: 'Reads your link, article or topic.', writer: 'Finds the idea and the hook.', art: 'Picks the look and the music.', director: 'Cuts the film on the beat grid.', critic: 'Measures every frame, sends notes back.' }[k]}</p></div></li>`).join('');

function chips(el, list, target) {
  el.innerHTML = list.map(([label]) => `<button type="button" class="chip">${esc(label)}</button>`).join('');
  [...el.children].forEach((b, i) => (b.onclick = () => { target.value = list[i][1]; target.focus(); }));
}

// ---- Crew log ------------------------------------------------------------------------------
function renderHistory() {
  const log = $('#log'); log.innerHTML = '';
  let take = 0;
  for (const m of S.project.messages || []) {
    if (m.role === 'user') log.insertAdjacentHTML('beforeend', `<li class="take" data-take-text="${esc(m.text)}"><span class="label">Take ${String(++take).padStart(2, '0')}</span><p>${esc(m.text)}</p></li>`);
    else log.insertAdjacentHTML('beforeend', `<li class="studio-msg">${esc(m.text)}</li>`);
  }
  S.takeCount = take;
  log.scrollTop = log.scrollHeight;
}
let current = {};   // agent -> entry element for this run
function onEvent(ev) {
  const log = $('#log');
  const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  if (ev.agent === 'studio' && ev.state === 'start') {
    // A replayed run replaces its summarized history with the full play-by-play.
    const prev = [...log.querySelectorAll('.take')].find((el) => el.dataset.takeText === ev.text);
    if (prev) { let n = prev; while (n) { const nx = n.nextElementSibling; n.remove(); n = nx; } }
    else S.takeCount = (S.takeCount || 0) + 1;
    const no = log.querySelectorAll('.take').length + 1;
    log.insertAdjacentHTML('beforeend', `<li class="take" data-take-text="${esc(ev.text)}"><span class="label">Take ${String(no).padStart(2, '0')}</span><p>${esc(ev.text)}</p></li>`);
    current = {};
    setBusy(true);
  } else if (ev.agent === 'studio' && ev.state === 'idle') { setBusy(false); }
  else if (ev.agent === 'studio' && ev.state === 'note') { log.insertAdjacentHTML('beforeend', `<li class="studio-msg dim">${esc(ev.text)}</li>`); }
  else if (ev.agent === 'studio' && ev.state === 'done') {
    log.insertAdjacentHTML('beforeend', `<li class="studio-msg">${esc(ev.text)}</li>`);
    if (ev.data?.spec && !ev.replay) { S.qa = ev.data.qa; setSpec(ev.data.spec, { save: false }).then(refreshProject); }
  } else if (ev.agent === 'studio' && ev.state === 'error') {
    log.insertAdjacentHTML('beforeend', `<li class="entry error"><span class="mark error"></span><div><span class="who">Studio</span><p class="what">${esc(ev.text)}</p></div></li>`);
    waitScreen(false);
  } else if (ev.agent === 'render') onRender(ev);
  else agentEvent(ev);
  if (stick) log.scrollTop = log.scrollHeight;
}
function entryFor(agent) {
  let e = current[agent];
  if (!e || e.dataset.closed === '1') {
    const li = document.createElement('li');
    li.className = 'entry';
    li.innerHTML = `<span class="mark run"></span><div><span class="who">${WHO[agent] || agent}</span><p class="what"></p></div>`;
    $('#log').appendChild(li);
    current[agent] = e = li;
  }
  return e;
}
function agentEvent(ev) {
  const e = entryFor(ev.agent), what = e.querySelector('.what');
  if (ev.state === 'start') { what.textContent = ev.text; waitScreen(!S.spec, `${WHO[ev.agent] || ev.agent}: ${ev.text}`); }
  else if (ev.state === 'think') {
    let d = e.querySelector('details');
    if (!d) { e.querySelector('div').insertAdjacentHTML('beforeend', '<details><summary>Thoughts</summary><p class="thoughts"></p></details>'); d = e.querySelector('details'); }
    const p = d.querySelector('.thoughts'); p.textContent = (p.textContent + ev.text).slice(-4000); p.scrollTop = p.scrollHeight;
  } else if (ev.state === 'note') {
    what.textContent = ev.text;
    if (ev.data?.sheet) e.querySelector('div').insertAdjacentHTML('beforeend', `<img class="sheet" src="${ev.data.sheet}" alt="Contact sheet" loading="lazy">`);
    if (ev.data?.brand?.colors) { const c = ev.data.brand.colors; e.querySelector('div').insertAdjacentHTML('beforeend', `<div class="chip-row">${[c.dark, c.light, c.accent].filter(Boolean).map((x) => `<span class="swatch" style="background:${x}" title="${x}"></span>`).join('')}</div>`); }
    e.querySelector('img.sheet')?.addEventListener('click', (x) => lightbox(x.target.src));
  } else if (ev.state === 'done') {
    what.textContent = ev.text;
    e.querySelector('.mark').className = 'mark done';
    e.dataset.closed = '1';
    if (ev.data?.spec && !ev.replay) { waitScreen(false); setSpec(ev.data.spec, { save: false }); }
    if (ev.data?.critique) applyMarks(ev.data.critique.fixes);
  } else if (ev.state === 'error') { what.textContent = ev.text; e.className = 'entry error'; e.querySelector('.mark').className = 'mark error'; e.dataset.closed = '1'; }
}

function connect() {
  S.es?.close();
  const es = new EventSource(`/api/projects/${S.id}/events`);
  es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch (e) { console.error(e); } };
  S.es = es;
}
function setBusy(b) {
  S.busy = b;
  $('#crew-state').dataset.busy = String(b);
  $('#crew-state-text').textContent = b ? 'Crew at work' : 'Crew ready';
  $('#send').disabled = b;
  if (!b) waitScreen(false);
  refreshPanes();
}
function waitScreen(on, text) { $('#screen-wait').hidden = !on; if (text) $('#screen-wait-text').textContent = text; }

// ---- Film ------------------------------------------------------------------------------------
let saveT = 0;
async function setSpec(spec, { save = true, note } = {}) {
  S.spec = spec;
  await player.load(spec);
  $('#tc-total').textContent = '/ ' + timecode(player.duration);
  const tl = player.film.timeline();
  S.sel = Math.min(S.sel, tl.length - 1);
  await rail.build(spec, tl, player.film.beat, player.duration, marksFromQA());
  rail.select(S.sel, false);
  for (const b of $('#formats').children) b.setAttribute('aria-pressed', String(b.dataset.format === spec.format));
  $('#render-draft').disabled = $('#render-master').disabled = !S.id;
  refreshPanes();
  if (save && S.id) { clearTimeout(saveT); saveT = setTimeout(() => api(`/api/projects/${S.id}/spec`, { method: 'PUT', body: JSON.stringify({ spec, note }) }).then(refreshProject).catch((e) => console.warn(e)), 700); }
}
function marksFromQA() {
  const m = {};
  if (!S.qa?.issues || !S.spec) return m;
  S.spec.scenes.forEach((_, i) => { m[i] = 'ok'; });
  for (const iss of S.qa.issues) if (iss.scene != null && iss.severity === 'major') m[iss.scene] = 'issue';
  return m;
}
function applyMarks(fixes = []) { const m = marksFromQA(); for (const f of fixes) if (f.scene >= 0) m[f.scene] = 'issue'; rail.setMarks(m); }
async function refreshProject() { if (!S.id) return; S.project = await api(`/api/projects/${S.id}`).catch(() => S.project); $('#film-title').textContent = S.project.title; refreshPanes(); }

function refreshPanes() {
  if (!S.spec) return;
  sceneForm($('#pane-scene'), S.spec.scenes[S.sel], S.sel, S.spec, (s, note) => setSpec(s, { note }));
  filmForm($('#pane-film'), S.spec, S.catalog?.moods || [], (s, note) => setSpec(s, { note }));
  reviewPane($('#pane-review'), S.qa, { busy: S.busy, onRun: runReview, onIssue: (iss) => { if (iss.scene != null) selectScene(iss.scene, true); } });
  takesPane($('#pane-takes'), S.project, { onRestore: (v) => { setSpec(v.spec, { note: 'Restored a take' }); } });
}
async function runReview() {
  const btn = $('#run-review'); if (btn) { btn.disabled = true; btn.textContent = 'Measuring'; }
  try { S.qa = await api(`/api/projects/${S.id}/review`, { method: 'POST' }); rail.setMarks(marksFromQA()); } catch (e) { alert(e.message); }
  refreshPanes();
}
function selectScene(i, seek) {
  S.sel = i; rail.select(i, false);
  if (seek && player.film) player.seek(player.film.timeline()[i].start + 0.001);
  sceneForm($('#pane-scene'), S.spec.scenes[i], i, S.spec, (s, note) => setSpec(s, { note }));
  showTab('scene');
}

// Fit the film into the stage at its aspect ratio (percent max-height can't resolve in a grid track).
function fitCanvas() {
  const sc = $('#screen'), c = $('#film');
  if (!player.film) return;
  const pad = innerWidth < 900 ? 24 : 48, w = sc.clientWidth - pad, h = sc.clientHeight - pad;
  const ar = player.film.W / player.film.H, cw = Math.max(40, Math.min(w, h * ar));
  c.style.width = cw + 'px'; c.style.height = cw / ar + 'px';
}
new ResizeObserver(fitCanvas).observe($('#screen'));
player.addEventListener('load', fitCanvas);

// Player <-> UI
player.addEventListener('time', (e) => {
  const t = e.detail;
  $('#tc').textContent = timecode(t);
  rail.setTime(t);
  const tl = player.film?.timeline() || [];
  const i = Math.max(0, tl.findIndex((s) => t >= s.start && t < s.start + s.dur));
  const beat = player.film ? Math.floor(t / player.film.beat) + 1 : 0;
  $('#scene-now').textContent = tl[i] ? `${String(i + 1).padStart(2, '0')} ${tl[i].type}` : '';
  $('#beat-now').textContent = player.film ? `beat ${beat}/${Math.round(player.duration / player.film.beat)}` : '';
});
player.addEventListener('play', () => { $('#play').dataset.playing = 'true'; $('#play').setAttribute('aria-label', 'Pause'); });
player.addEventListener('pause', () => { $('#play').dataset.playing = 'false'; $('#play').setAttribute('aria-label', 'Play'); });
$('#play').onclick = () => player.toggle();
$('#film').onclick = () => player.toggle();
$('#mute').onclick = () => { const m = $('#mute').getAttribute('aria-pressed') !== 'true'; $('#mute').setAttribute('aria-pressed', String(m)); $('#mute').setAttribute('aria-label', m ? 'Sound off' : 'Sound on'); player.mute(m); };
rail.addEventListener('scrub', (e) => { if (e.detail.phase === 'start' && player.playing) { rail._resume = true; player.pause(); } player.seek(e.detail.t); if (e.detail.phase === 'end' && rail._resume) { rail._resume = false; player.play(); } });
rail.addEventListener('select', (e) => selectScene(e.detail, false));
for (const b of $('#formats').children) b.onclick = () => { if (S.spec && S.spec.format !== b.dataset.format) setSpec({ ...structuredClone(S.spec), format: b.dataset.format }, { note: `Format ${b.dataset.format}` }); };

// Keyboard: instant, never animated.
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable]') || !player.film) return;
  const b = player.film.beat;
  if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
  else if (e.key === 'ArrowRight' && !e.shiftKey) { e.preventDefault(); player.seek((Math.floor(player.t / b + 1e-6) + 1) * b); }
  else if (e.key === 'ArrowLeft' && !e.shiftKey) { e.preventDefault(); player.seek((Math.ceil(player.t / b - 1e-6) - 1) * b); }
  else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); selectScene(Math.min(S.sel + 1, S.spec.scenes.length - 1), true); }
  else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); selectScene(Math.max(S.sel - 1, 0), true); }
  else if (e.key === 'Home') { e.preventDefault(); player.seek(0); }
});

// ---- Tabs --------------------------------------------------------------------------------------
function showTab(name) {
  for (const t of document.querySelectorAll('.tabs [role=tab]')) {
    const on = t.id === 't-' + name;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  }
}
document.querySelectorAll('.tabs [role=tab]').forEach((t, i, all) => {
  t.onclick = () => showTab(t.id.slice(2));
  t.onkeydown = (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length]; n.focus(); n.click(); } };
});

// ---- Composer -------------------------------------------------------------------------------------
async function send(text) {
  text = text.trim(); if (!text) return;
  try {
    if (!S.id) { const { id } = await api('/api/projects', { method: 'POST', body: JSON.stringify({ message: text }) }); location.hash = id; }
    else { await api(`/api/projects/${S.id}/messages`, { method: 'POST', body: JSON.stringify({ message: text }) }); }
    return true;
  } catch (e) { alert(e.message); return false; }
}
for (const [form, ta] of [[$('#composer'), $('#msg')], [$('#empty-form'), $('#empty-msg')]]) {
  form.addEventListener('submit', async (e) => { e.preventDefault(); if (await send(ta.value)) ta.value = ''; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
}

// ---- Render ----------------------------------------------------------------------------------------
async function render(quality) {
  if (!S.id) return;
  try { await api(`/api/projects/${S.id}/render`, { method: 'POST', body: JSON.stringify({ quality }) }); } catch (e) { alert(e.message); }
}
$('#render-draft').onclick = () => render('draft');
$('#render-master').onclick = () => render('master');
function onRender(ev) {
  const line = $('#render-line');
  if (ev.state === 'start' || ev.state === 'progress') { line.style.setProperty('--p', String(ev.data?.progress ?? 0.02)); $('#render-master').disabled = $('#render-draft').disabled = true; }
  if (ev.state === 'progress' && !ev.replay) $('#crew-state-text').textContent = `Rendering ${Math.round((ev.data?.progress || 0) * 100)}%`;
  if (ev.state === 'done' || ev.state === 'error') {
    line.style.setProperty('--p', '0'); $('#render-master').disabled = $('#render-draft').disabled = false;
    $('#crew-state-text').textContent = S.busy ? 'Crew at work' : 'Crew ready';
    const li = document.createElement('li'); li.className = 'entry' + (ev.state === 'error' ? ' error' : '');
    li.innerHTML = `<span class="mark ${ev.state === 'error' ? 'error' : 'done'}"></span><div><span class="who">Render</span><p class="what">${esc(ev.text)}</p>${ev.data?.file ? `<p class="what"><a href="${ev.data.file}" download>Download MP4</a></p>` : ''}</div>`;
    $('#log').appendChild(li);
    if (!ev.replay) { refreshProject().then(() => showTab('takes')); }
  }
}

boot();
