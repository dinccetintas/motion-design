// Inspector panes. Scene fields are generated from the same JSON schema the agents use,
// so every scene type is editable by hand without per-type UI code.
import { PROPS } from '/engine/schema.js';
import { STYLES, resolveStyle } from '/engine/styles.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AXES = [['hook', 'Hook'], ['readability', 'Readability'], ['motion', 'Motion'], ['variety', 'Variety'], ['brand', 'Brand'], ['sync', 'Sound sync']];
const LONG = new Set(['text', 'code', 'label', 'tagline']);
const TRANSITIONS = ['cut', 'panel', 'wipe', 'slice', 'push', 'stack', 'zoom', 'iris', 'split'];

/** Serialize/parse a prop value to and from its form control. */
function toField(def, v) {
  if (def.type === 'array') {
    const it = def.items || {};
    if (it.type === 'object') return (v || []).map((o) => Object.keys(it.properties).map((k) => o?.[k] ?? '').join(' | ')).join('\n');
    if (it.type === 'number') return (v || []).join(', ');
    return (v || []).join('\n');
  }
  return v ?? '';
}
function fromField(def, raw) {
  if (def.type === 'array') {
    const it = def.items || {};
    if (it.type === 'object') {
      const keys = Object.keys(it.properties);
      return raw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const parts = l.split('|').map((x) => x.trim()), o = {};
        keys.forEach((k, i) => { const pd = it.properties[k]; o[k] = pd.type === 'number' ? Number(parts[i]) || 0 : parts[i] ?? ''; });
        return o;
      });
    }
    if (it.type === 'number') return raw.split(/[,\s]+/).filter(Boolean).map(Number).filter(Number.isFinite);
    return raw.split('\n').map((l) => l.trim()).filter(Boolean);
  }
  if (def.type === 'number' || def.type === 'integer') { const n = Number(raw); return raw === '' || !Number.isFinite(n) ? undefined : n; }
  return raw === '' ? undefined : raw;
}

export function sceneForm(el, scene, i, spec, onChange) {
  if (!scene) { el.innerHTML = '<p class="empty-pane">Select a frame on the rail.</p>'; return; }
  const schema = PROPS[scene.type];
  const assets = Object.keys(spec.assets || {});
  const fields = Object.entries(schema.properties).map(([k, def]) => {
    const id = `p-${k}`, req = schema.required.includes(k);
    const lab = `<label for="${id}" class="label">${k}${req ? '' : ' <span class="dim">(optional)</span>'}</label>`;
    const hint = def.description ? `<p class="hint">${esc(def.description)}</p>` : '';
    if ((k === 'image' || k === 'logo') && def.type === 'string') return `<div class="row">${lab}<select class="field" id="${id}" data-k="${k}"><option value="">none</option>${assets.map((a) => `<option ${scene.props[k] === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>`;
    if (def.enum) return `<div class="row">${lab}<select class="field" id="${id}" data-k="${k}">${def.enum.map((o) => `<option ${scene.props[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
    if (def.type === 'object') return `<div class="row"><span class="label">${k}</span>${Object.keys(def.properties).map((sk) => `<input class="field" data-k="${k}" data-sk="${sk}" placeholder="${sk}" value="${esc(scene.props[k]?.[sk])}" aria-label="${k} ${sk}">`).join('')}</div>`;
    const v = esc(toField(def, scene.props[k]));
    const multi = def.type === 'array' || LONG.has(k);
    return `<div class="row">${lab}${multi ? `<textarea class="field" id="${id}" data-k="${k}" rows="${def.type === 'array' ? 4 : 3}">${v}</textarea>` : `<input class="field" id="${id}" data-k="${k}" value="${v}" ${def.type === 'number' || def.type === 'integer' ? 'inputmode="decimal"' : ''}>`}${def.type === 'array' && def.items?.type === 'object' ? `<p class="hint">One per line: ${Object.keys(def.items.properties).join(' | ')}</p>` : hint}</div>`;
  }).join('');
  el.innerHTML = `
    <h3 class="label">Scene ${i + 1}</h3>
    <div class="row"><label class="label" for="s-type">Type</label><select class="field" id="s-type">${Object.keys(PROPS).filter((t) => (t !== 'screen' && t !== 'image') || assets.length).map((t) => `<option ${t === scene.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="row"><span class="label">Length</span><div class="stepper"><button type="button" data-step="-1" aria-label="One beat shorter">−</button><output id="s-beats">${scene.beats} beats</output><button type="button" data-step="1" aria-label="One beat longer">+</button></div></div>
    <div class="row"><span class="label">Ground</span><div class="grounds" id="s-ground"></div></div>
    <div class="row"><label class="label" for="s-tr">Enters with</label><select class="field" id="s-tr" ${i === 0 ? 'disabled' : ''}>${TRANSITIONS.map((t) => `<option ${(scene.transition?.type || scene.transition) === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <h3 class="label">Copy</h3><p class="hint" style="margin:-4px 0 12px">Wrap the accent word in *asterisks*.</p>
    ${fields}`;
  const st = resolveStyle(spec.style, spec);
  el.querySelector('#s-ground').innerHTML = ['dark', 'light', 'accent'].map((gk) => `<button type="button" data-g="${gk}" aria-pressed="${scene.ground === gk}" style="background:${st.grounds[gk].bg};color:${st.grounds[gk].ink}">${gk}</button>`).join('');
  const commit = (mut) => { const s = structuredClone(spec); mut(s.scenes[i]); onChange(s, `Edited scene ${i + 1}`); };
  el.querySelector('#s-type').onchange = (e) => commit((sc) => { sc.type = e.target.value; });
  el.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => commit((sc) => { sc.beats = Math.max(2, Math.min(16, (sc.beats || 4) + +b.dataset.step)); })));
  el.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => commit((sc) => { sc.ground = b.dataset.g; })));
  el.querySelector('#s-tr').onchange = (e) => commit((sc) => { sc.transition = e.target.value; });
  let t = 0;
  el.querySelectorAll('[data-k]').forEach((inp) => {
    inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      clearTimeout(t);
      t = setTimeout(() => commit((sc) => {
        const k = inp.dataset.k, def = schema.properties[k];
        if (inp.dataset.sk) { sc.props[k] = { ...(sc.props[k] || {}), [inp.dataset.sk]: inp.value }; return; }
        const v = def.enum || k === 'image' || k === 'logo' ? inp.value || undefined : fromField(def, inp.value);
        if (v === undefined) delete sc.props[k]; else sc.props[k] = v;
      }), 350);
    });
  });
}

export function filmForm(el, spec, moods, onChange) {
  const st = resolveStyle(spec.style, spec);
  el.innerHTML = `
    <h3 class="label">Style</h3>
    <div class="styles">${Object.entries(STYLES).map(([id, s]) => `<button type="button" class="style-opt" data-style="${id}" aria-pressed="${spec.style === id}">
      <span class="sample" style="font-family:'${s.fonts.display.family}';font-weight:${s.fonts.display.weight};${s.fonts.display.caps ? 'text-transform:uppercase;' : ''}">${s.name}</span>
      <span class="pal"><i style="background:${s.palette.dark}"></i><i style="background:${s.palette.light}"></i><i style="background:${s.palette.accent}"></i></span></button>`).join('')}</div>
    <h3 class="label">Colors</h3>
    <div class="colors">${['dark', 'light', 'accent'].map((k) => `<label>${k}<input type="color" data-c="${k}" value="${(spec.palette?.[k] || st.palette[k]).slice(0, 7)}"></label>`).join('')}</div>
    <p class="hint" style="margin-top:8px"><button type="button" class="chip" id="reset-colors">Use style colors</button></p>
    <h3 class="label">Music</h3>
    <div class="moods">${moods.map((m) => `<button type="button" class="mood-opt" data-mood="${m.id}" aria-pressed="${spec.music?.mood === m.id}"><b>${m.name}</b><span>${m.bpm} bpm</span></button>`).join('')}</div>`;
  const commit = (mut, note) => { const s = structuredClone(spec); mut(s); onChange(s, note); };
  el.querySelectorAll('[data-style]').forEach((b) => (b.onclick = () => commit((s) => { s.style = b.dataset.style; s.accentStyle = STYLES[s.style].accentStyle; }, `Style: ${STYLES[b.dataset.style].name}`)));
  el.querySelectorAll('[data-mood]').forEach((b) => (b.onclick = () => commit((s) => { s.music = { ...(s.music || {}), mood: b.dataset.mood }; delete s.music.bpm; }, `Music: ${b.dataset.mood}`)));
  let t = 0;
  el.querySelectorAll('[data-c]').forEach((inp) => inp.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => commit((s) => { s.palette = { ...(s.palette || st.palette), [inp.dataset.c]: inp.value }; }, 'Colors'), 200);
  }));
  el.querySelector('#reset-colors').onclick = () => commit((s) => { delete s.palette; }, 'Style colors');
}

export function reviewPane(el, qa, { onRun, onIssue, busy }) {
  if (!qa?.scores) { el.innerHTML = `<p class="empty-pane">No review yet.</p><button class="tab small" id="run-review" type="button" ${busy ? 'disabled' : ''}>Review the cut</button>`; el.querySelector('#run-review').onclick = onRun; return; }
  const pass = Object.values(qa.scores).every((v) => v >= 8);
  el.innerHTML = `
    <div class="overall"><span class="label">${pass ? 'Approved' : 'Notes open'}</span><span class="v">${(qa.overall ?? 0).toFixed(1)}</span></div>
    ${AXES.map(([k, n]) => `<div class="score${qa.scores[k] < 8 ? ' low' : ''}"><span class="k">${n}</span><span class="v">${qa.scores[k].toFixed(1)}</span>${qa.scores[k] >= 8 ? '<span class="cross" aria-label="passes"></span>' : '<span aria-label="below 8"></span>'}</div>`).join('')}
    <h3 class="label">What the critic found</h3>
    ${qa.issues?.length ? `<ul class="issues">${qa.issues.slice(0, 14).map((iss, j) => `<li data-j="${j}"><b>${iss.scene != null ? 'Scene ' + (iss.scene + 1) : iss.axis}</b>${esc(iss.msg)}<span class="fix">${esc(iss.fix)}</span></li>`).join('')}</ul>` : '<p class="empty-pane">Nothing to fix.</p>'}
    ${qa.sheet ? `<h3 class="label">Contact sheet</h3><img class="sheet" src="${qa.sheet}" alt="Contact sheet: one frame per beat">` : ''}
    <p style="margin-top:16px"><button class="tab small" id="run-review" type="button" ${busy ? 'disabled' : ''}>Review again</button></p>`;
  el.querySelector('#run-review').onclick = onRun;
  el.querySelectorAll('.issues li').forEach((li) => (li.onclick = () => onIssue(qa.issues[+li.dataset.j])));
  el.querySelector('img.sheet')?.addEventListener('click', (e) => lightbox(e.target.src));
}

export function takesPane(el, project, { onRestore }) {
  const vs = [...(project?.versions || [])].reverse();
  const rs = project?.renders || [];
  el.innerHTML = `
    <h3 class="label">Renders</h3>
    ${rs.length ? `<ul class="renders">${rs.map((r) => `<li><video src="${r.file}" poster="${r.poster || ''}" controls preload="none" playsinline></video>
      <div class="meta"><span>${r.quality} • ${r.format} • ${r.duration?.toFixed(1)}s • ${r.loudness?.lufs ?? '?'} LUFS</span><a href="${r.file}" download>Download</a></div></li>`).join('')}</ul>` : '<p class="empty-pane">No renders yet. Draft renders in about a third of the time of a master.</p>'}
    <h3 class="label">Takes</h3>
    ${vs.length ? `<ol class="takes">${vs.map((v, j) => `<li><span class="pin" aria-hidden="true"></span><button type="button" data-j="${vs.length - 1 - j}">
      <span class="note">${esc(v.note || 'Take')}</span><span class="meta">${new Date(v.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${v.qa?.overall != null ? ' • ' + v.qa.overall.toFixed(1) : ''} • ${v.spec.scenes.length} scenes • ${v.spec.format}</span></button></li>`).join('')}</ol>` : '<p class="empty-pane">Every cut the crew or you make is kept here.</p>'}`;
  el.querySelectorAll('.takes button').forEach((b) => (b.onclick = () => onRestore(project.versions[+b.dataset.j])));
}

export function lightbox(src) {
  const d = document.createElement('div'); d.className = 'lightbox'; d.innerHTML = `<img src="${src}" alt="">`;
  d.onclick = () => d.remove(); document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { d.remove(); document.removeEventListener('keydown', k); } });
  document.body.appendChild(d);
}
