// The offline director: heuristic stand-ins for every agent, so the studio produces a
// real film without an API key. Same inputs and outputs as the model-backed agents.
import { STYLES } from '../../engine/styles.js';
import { MOODS } from '../../engine/audio/score.js';

const STOP = new Set('a an the and or but of to in on for with by at from as is are be was were it its this that these those your you our we they their into over under than then so not no more most very just can will all any every how what why when who'.split(' '));
/** Interface copy, not message: forms, navigation, cookie banners. */
const UI = /\b(enter your|sign (in|up)|log ?in|get started|subscribe|your email|cookie|click|download the app|contact (us|sales)|learn more|book a demo|recommendations|url)\b/i;
const words = (s) => String(s || '').replace(/\*/g, '').split(/\s+/).filter(Boolean);
/** Trim to n words at a natural boundary, without trailing stop words or punctuation. */
export function short(s, n) {
  let w = words(String(s).split(/[.!?;:—–|(]/)[0]).slice(0, n);
  while (w.length > 1 && STOP.has(w[w.length - 1].toLowerCase().replace(/\W/g, ''))) w.pop();
  return w.join(' ').replace(/[,\-–—:;]+$/, '');
}
/** Mark the most meaningful word as the accent. */
export function accentize(s) {
  const w = words(s);
  if (!w.length || /\*/.test(s)) return s;
  let best = -1, score = -1;
  w.forEach((x, i) => {
    const c = x.toLowerCase().replace(/\W/g, '');
    if (STOP.has(c) || c.length < 3) return;
    const sc = c.length + (i >= w.length / 2 ? 3 : 0) + (/^[A-Z]/.test(x) && i > 0 ? 2 : 0);
    if (sc > score) { score = sc; best = i; }
  });
  if (best < 0) best = w.length - 1;
  const m = w[best].match(/^(\W*)(.*?)(\W*)$/);
  w[best] = `${m[1]}*${m[2]}*${m[3]}`;
  return w.join(' ');
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Parse a number phrase like "$4.2M", "87%", "40,000" into counter props. */
export function parseNumber(raw) {
  const m = String(raw).match(/^([$€£]?)\s?([\d,]*\.?\d+)\s?(%|x|×|k|K|M|B|bn|million|billion|\+)?/);
  if (!m) return null;
  let value = parseFloat(m[2].replace(/,/g, '')), suffix = m[3] || '';
  if (suffix === 'million') suffix = 'M'; if (suffix === 'billion' || suffix === 'bn') suffix = 'B';
  const decimals = /\.\d/.test(m[2]) ? Math.min(2, m[2].split('.')[1].length) : 0;
  return { value, prefix: m[1] || '', suffix: suffix === '×' ? 'x' : suffix, decimals };
}

/** Requests in plain language: format, length, style, mood, colors. */
export function parseRequest(text = '') {
  const t = String(text).toLowerCase(), r = {};
  if (/\b(9:16|vertical|reel|reels|tiktok|shorts|story|stories|portrait)\b/.test(t)) r.format = '9:16';
  if (/\b(16:9|horizontal|landscape|youtube|widescreen|wide|presentation)\b/.test(t)) r.format = '16:9';
  if (/\b(1:1|square)\b/.test(t)) r.format = '1:1';
  if (/\b4:5\b/.test(t)) r.format = '4:5';
  const d = t.match(/(\d{1,3})\s*(s|sec|secs|second|seconds|saniye)\b/); if (d) r.duration = Math.min(90, Math.max(8, +d[1]));
  if (/\b(shorter|tighter|quicker)\b/.test(t)) r.shorter = true;
  if (/\b(longer|extend)\b/.test(t)) r.longer = true;
  for (const [id, s] of Object.entries(STYLES)) if (t.includes(id) || t.includes(s.name.toLowerCase())) r.style = id;
  const moodWords = { hype: /\b(hype|energetic|aggressive|intense|trap|hard)\b/, chill: /\b(chill|calm|relaxed|lo-?fi|soft)\b/, cinematic: /\b(epic|cinematic|trailer|dramatic)\b/, luxe: /\b(luxury|luxurious|elegant|premium|refined)\b/, bright: /\b(happy|upbeat|fun|playful|sunny|cheerful)\b/, pulse: /\b(minimal|techno|nocturnal|focused)\b/, drive: /\b(driving|confident|punchy)\b/ };
  for (const [m, re] of Object.entries(moodWords)) if (re.test(t)) { r.mood = m; break; }
  for (const m of Object.keys(MOODS)) if (new RegExp(`\\b${m}\\b`).test(t)) r.mood = m;
  const hex = t.match(/#[0-9a-f]{6}\b/); if (hex) r.accent = hex[0];
  const named = { red: '#E8222B', orange: '#FF5A1F', yellow: '#FFD400', green: '#1DB954', teal: '#0FB5AE', blue: '#2F55FF', purple: '#7C5CFF', violet: '#7C5CFF', pink: '#FF4FA0', lime: '#C6FF3D', gold: '#C9A15C' };
  const cm = t.match(/\b(red|orange|yellow|green|teal|blue|purple|violet|pink|lime|gold)\b/); if (cm && /\b(color|colour|accent|make it|use)\b/.test(t)) r.accent = named[cm[1]];
  if (/\b(dark|darker|black)\b/.test(t) && /\b(more|mostly|theme|mode|background)\b/.test(t)) r.darker = true;
  if (/\b(light|lighter|bright background|white)\b/.test(t) && /\b(more|mostly|theme|mode|background)\b/.test(t)) r.lighter = true;
  return r;
}

// ---- Researcher -----------------------------------------------------------------
export function dossierFrom(raw, request = '') {
  if (raw.kind === 'url') {
    const h = raw.headings || {};
    const promise = h.h1?.[0] || raw.description || raw.title;
    const proof = [...(h.h2 || []), ...(h.h3 || [])].filter((x) => words(x).length >= 2 && words(x).length <= 9 && !UI.test(x)).slice(0, 8);
    return {
      subject: raw.name, audience: '', promise, tone: '', proof,
      numbers: (raw.numbers || []).slice(0, 4).map((n) => ({ value: n.raw, meaning: n.sentence, source: raw.url })),
      phrases: [raw.description, ...(raw.paragraphs || []).slice(0, 6)].filter((x) => x && !UI.test(x)), quotes: [], cta: (raw.ctas || [])[0] || 'Learn more', sources: [raw.url],
    };
  }
  if (raw.kind === 'article') {
    const p = raw.paragraphs || [];
    const quotes = [];
    for (const s of p) { const m = s.match(/[“"]([^”"]{25,200})[”"][,.]?\s*(?:said|says|wrote)\s+([A-Z][\w.-]+(?:\s[A-Z][\w.-]+)?)/); if (m) quotes.push({ text: m[1], speaker: m[2] }); }
    return { subject: raw.title, audience: '', promise: p[0] || raw.title, tone: '', proof: p.slice(1, 6), numbers: (raw.numbers || []).slice(0, 4).map((n) => ({ value: n.raw, meaning: n.sentence })), phrases: p.slice(0, 8), quotes: quotes.slice(0, 2), cta: 'Read the full story', sources: [] };
  }
  // "A 20-second launch film for a coffee subscription that ..." -> "a coffee subscription that ..."
  const subject = String(raw.topic).replace(/^(a|an|the)?\s*(\d+[- ]?(second|sec|s)\s+)?(launch|promo|promotional|short|motion|explainer|brand|product|social)?\s*(film|video|reel|ad|spot|teaser)\s+(for|about|on|of)\s+/i, '').replace(/^(a|an|the)\s+/i, '');
  return { subject: cap(subject), audience: '', promise: cap(subject), tone: '', proof: [], numbers: [], phrases: [], quotes: [], cta: '', sources: [] };
}

// ---- Art director -----------------------------------------------------------------
export function artFrom(dossier, raw, request = '') {
  const r = parseRequest(request);
  const text = `${dossier.subject} ${dossier.promise} ${(dossier.proof || []).join(' ')} ${request}`.toLowerCase();
  let style = 'swiss';
  if (/\b(ai|data|security|developer|api|cloud|code|infra|agent)s?\b/.test(text)) style = 'noir';
  if (raw.kind === 'article') style = 'folio';
  if (/\b(fashion|hotel|luxury|wine|jewel|architecture|interior)\b/.test(text)) style = 'luxe';
  if (/\b(game|food|kids|creator|fun|social|music)\b/.test(text)) style = 'pop';
  if (/\b(sale|event|festival|concert|sneaker|drop)\b/.test(text)) style = 'loud';
  if (/\b(health|wellness|learn|education|mindful|sleep)\b/.test(text)) style = 'pastel';
  if (/\b(robot|hardware|car|engine|manufactur|energy|industrial)\b/.test(text)) style = 'machine';
  if (/\b(finance|payment|bank|saas|startup|fintech)\b/.test(text)) style = 'funnel';
  if (r.style) style = r.style;
  const moodFor = { swiss: 'drive', noir: 'pulse', folio: 'cinematic', loud: 'hype', pastel: 'chill', poster: 'cinematic', luxe: 'luxe', pop: 'bright', machine: 'pulse', funnel: 'drive' };
  const b = raw.brand?.colors || {};
  const base = STYLES[style].palette;
  const palette = { dark: b.dark || base.dark, light: b.light || base.light, accent: r.accent || b.accent || base.accent };
  return { style, mood: r.mood || moodFor[style], format: r.format || '9:16', accentStyle: STYLES[style].accentStyle, palette, rationale: `${STYLES[style].name} fits "${short(dossier.subject || '', 6)}"; ${b.accent ? 'accent taken from the brand' : 'house accent'}.` };
}

// ---- Writer + director --------------------------------------------------------------
/** A real paragraph worth quoting: a sentence or two of prose, not navigation or a code sample. */
export function pickParagraph(paras = []) {
  const ok = paras.map((x) => String(x).trim()).filter((x) => {
    const n = words(x).length;
    return n >= 12 && n <= 40 && /[a-z]/.test(x) && /[.!?]$/.test(x) && !/[_{}<>=]/.test(x) && !UI.test(x);
  });
  return ok.sort((a, b) => Math.abs(words(a).length - 24) - Math.abs(words(b).length - 24))[0] || null;
}
/** The phrase in a paragraph to mark: its strongest clause of 3-7 words, verbatim. */
export function pickMark(text) {
  const clauses = text.split(/[,.;:!?()—–]/).map((c) => c.trim()).filter(Boolean);
  const scored = clauses.map((c) => {
    let w = words(c);
    while (w.length > 7) w = w.slice(1);
    while (w.length > 1 && STOP.has(w[0].toLowerCase())) w = w.slice(1);
    while (w.length > 1 && STOP.has(w[w.length - 1].toLowerCase())) w = w.slice(0, -1);
    const phrase = w.join(' ');
    const weight = w.filter((x) => !STOP.has(x.toLowerCase()) && x.length > 3).length;
    return { phrase, score: w.length >= 3 ? weight * 2 - Math.abs(w.length - 5) : -9 };
  }).filter((c) => c.phrase && new RegExp(`(^|[\\s—–(])${c.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s,.;:!?)—–]|$)`).test(text));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.phrase || words(text).slice(-5).join(' ');
}
/** Break a headline into split-flap lines of at most 12 characters, or null if it will not fit 3 lines. */
export function flapLines(text) {
  const lines = [];
  for (const w of words(text.replace(/[^\w\s'&.-]/g, '').toUpperCase())) {
    if (w.length > 12) return null;
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 12) lines[lines.length - 1] = last + ' ' + w; else lines.push(w);
  }
  return lines.length >= 1 && lines.length <= 3 ? lines : null;
}
/** A clause that stands on its own in at most n words, or null: never a sentence cut mid-thought. */
export function clause(s, n) {
  const c = String(s || '').split(/[.!?;:—–(]/)[0].split(/,\s/)[0].trim().replace(/[,\-]+$/, '');
  const w = words(c);
  return w.length >= 3 && w.length <= n ? c : null;
}
const seedOf = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function directFrom(dossier, art, raw, request = '') {
  const r = parseRequest(request);
  const scenes = [];
  const name = raw.name || short(dossier.subject || raw.title || 'Untitled', 4);
  const push = (type, props, beats, transition) => scenes.push({ type, props, beats: beats || undefined, transition });
  const seed = seedOf(name);
  // Hook: the h1 if it is punchy, else the first short headline; never "X is a ...".
  const strip = (x) => String(x || '').replace(new RegExp(`^${name}\\s+(is|are)\\s+(a|an|the)\\s+`, 'i'), '');
  const heads = [raw.headings?.h1?.[0], ...(raw.headings?.h2 || [])].filter((x) => x && words(x).length >= 2 && words(x).length <= 8);
  const hookSrc = heads[0] || strip(dossier.promise) || dossier.subject || name;
  const hookText = cap(short(hookSrc, 5));
  // Three ways to open, chosen by the material: a departure board for short punchy lines,
  // letters assembling a short name, otherwise kinetic type.
  const flap = flapLines(hookText);
  const opener = seed % 3;
  if (flap && opener === 0) push('flap', { lines: flap.map((l, i) => (i === flap.length - 1 ? `*${l}*` : l)) }, 6, 'cut');
  else if (raw.kind === 'url' && name.length <= 10 && opener === 1) push('assemble', { text: `*${name}*`, sub: short(hookSrc, 6) }, 6, 'cut');
  else push('title', { text: accentize(hookText) }, 4, 'cut');

  if (raw.assets?.page || raw.assets?.hero) push('screen', { image: raw.assets.page ? 'page' : 'hero', title: short(dossier.proof?.[0] || name, 5), url: raw.host || '', focus: [0.3, 0.32] }, 8, 'stack');
  // A real photograph from the source: seen through the brand's name, then the camera dives in.
  if (raw.assets?.photo) {
    const kwWord = words(`${dossier.subject} ${dossier.promise}`).map((w) => w.replace(/\W/g, '')).find((w) => w.length >= 3 && w.length <= 8 && !STOP.has(w.toLowerCase()));
    const word = /^[\w&]{2,8}$/.test(name) ? name : kwWord;
    const cap1 = (dossier.proof || []).map((x) => clause(x, 7)).find(Boolean) || clause(strip(dossier.promise || ''), 7);
    if (word) push('plate', { image: 'photo', word, caption: cap1 ? accentize(cap(cap1)) : undefined }, 7, 'cut');
  }
  const num = (dossier.numbers || []).map((n) => ({ n, p: parseNumber(n.value) })).find((x) => x.p && x.p.value > 0);
  if (num) {
    // Label: the clause right after the number reads best ("$5B | in online revenue").
    const sent = num.n.meaning, at = sent.indexOf(num.n.value);
    const after = short(sent.slice(at + num.n.value.length).replace(/^[\s,.\-–—]+/, '').replace(/^(billion|million)\s+/i, ''), 7);
    const before = short(sent.slice(0, Math.max(0, at)).split(/[,;:]/).pop(), 7);
    const label = words(after).length >= 3 ? after : before || after;
    push('counter', { ...num.p, label: accentize(label || 'and counting') }, 6, 'wipe');
  }
  // The source in its own words, with the line that matters marked.
  const para = pickParagraph(raw.kind === 'topic' ? [] : (raw.paragraphs || dossier.phrases || []));
  if (para) push('highlight', { text: para, mark: pickMark(para), source: raw.host || raw.title || undefined }, 8, 'panel');
  if (raw.assets?.mobile) push('device', { image: 'mobile', title: short((dossier.proof || [])[1] || dossier.promise || name, 5), focus: [0.5, 0.42] }, 8, 'push');
  const items = (dossier.proof || []).map((p) => short(p, 3)).filter((p) => words(p).length >= 2 && words(p).length <= 4);
  const uniq = [...new Set(items)].slice(0, 3);
  if (uniq.length >= 2) push('stack', { items: uniq }, 6, 'slice');
  const phrase = [...(dossier.phrases || []).filter((p) => p !== para), dossier.promise].map((p) => clause(strip(p), 9)).find((c) => c && words(c).length >= 4);
  if (phrase && scenes.length < 7) push('statement', { text: accentize(cap(phrase)) }, 6, 'iris');
  if (dossier.quotes?.length) push('quote', { text: accentize(short(dossier.quotes[0].text, 20)), author: dossier.quotes[0].speaker }, 8, 'push');
  const kw = words(`${dossier.subject} ${dossier.promise}`).map((w) => w.replace(/\W/g, '')).filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()));
  const kws = [...new Set(kw.map((w) => w.toUpperCase()))].slice(0, 4);
  if (raw.kind === 'topic' || scenes.length < 4) {
    if (kws.length >= 3) push('tunnel', { words: kws.slice(0, 4) }, 6, 'iris');
    push('justify', { lines: kws.slice(0, 3).map((w, i) => (i === 1 ? `*${w}*` : w)) }, 6, 'cut');
    // The payoff word assembles from scattered letters.
    const pay = kws.find((w) => w.length >= 4 && w.length <= 10);
    if (pay && scenes[0].type !== 'assemble') push('assemble', { text: `*${cap(pay.toLowerCase())}*`, sub: short(dossier.subject || name, 6) }, 6, 'push');
    else push('grid', { text: short(dossier.subject || name, 3) }, 6, 'push');
  } else if (kws.length >= 3 && scenes.length < 8) push('justify', { lines: kws.slice(0, 3).map((w, i) => (i === 1 ? `*${w}*` : w)) }, 4, 'cut');
  push('endcard', { name, tagline: cap(clause(strip(raw.description || ''), 7) || clause(strip(dossier.promise || ''), 7) || short(strip(dossier.promise || ''), 4)), cta: short(dossier.cta || '', 3) || undefined, url: raw.host || undefined, logo: raw.assets?.logo ? 'logo' : undefined }, 6, 'zoom');
  // Grounds: dark / light alternation, accent every third scene.
  const pattern = r.lighter ? ['light', 'dark', 'light', 'accent'] : ['dark', 'light', 'dark', 'accent', 'light', 'dark', 'light'];
  scenes.forEach((s, i) => { s.ground = i === scenes.length - 1 ? 'accent' : pattern[i % pattern.length]; });
  if (scenes.length >= 2 && scenes[scenes.length - 2].ground === 'accent') scenes[scenes.length - 2].ground = 'dark';
  return {
    title: name, concept: `${name}: ${short(dossier.promise || '', 10)}`, format: art.format, style: art.style,
    accentStyle: art.accentStyle, palette: art.palette, music: { mood: art.mood, seed: 1 + (name.length * 7) % 97 }, scenes: fitDuration(scenes, r, MOODS[art.mood].bpm),
  };
}

/** Respect a requested duration by trimming or extending beats. */
function fitDuration(scenes, r, bpm) {
  const beat = 60 / bpm, total = () => scenes.reduce((a, s) => a + (s.beats || 6), 0) * beat;
  if (r.duration) {
    const k = r.duration / total();
    scenes.forEach((s) => { s.beats = Math.max(3, Math.min(10, Math.round((s.beats || 6) * k))); });
  }
  return scenes;
}

// ---- Critic + revision ------------------------------------------------------------
/** Turn QA issues into fixes the offline reviser can apply. */
export function critiqueFrom(qa) {
  const fixes = qa.issues.filter((i) => i.severity === 'major').slice(0, 6).map((i) => ({ scene: i.scene ?? -1, problem: i.msg, change: i.fix, axis: i.axis }));
  return { scores: qa.scores, verdict: qa.pass ? 'Ready.' : 'Needs another pass.', fixes };
}

export function reviseSpec(spec, critique, request = '') {
  const s = JSON.parse(JSON.stringify(spec)), r = parseRequest(request);
  for (const f of critique?.fixes || []) {
    const sc = s.scenes[f.scene];
    if (!sc) continue;
    if (/too fast to read/.test(f.problem)) {
      const m = f.change.match(/give the scene (\d+) beats/);
      if (m && +m[1] <= 10) sc.beats = +m[1];
      else for (const k of ['text', 'label', 'sub', 'tagline']) if (sc.props[k]) sc.props[k] = accentize(short(sc.props[k], Math.max(3, words(sc.props[k]).length - 3)));
    }
    if (/unreadable|small/.test(f.problem)) for (const k of ['text', 'label', 'sub']) if (sc.props[k]) sc.props[k] = accentize(short(sc.props[k], Math.max(3, words(sc.props[k]).length - 2)));
    if (/contrast/.test(f.problem)) sc.ground = sc.ground === 'accent' ? 'dark' : sc.ground === 'dark' ? 'light' : 'dark';
    if (/in a row/.test(f.problem) && f.axis === 'variety') sc.ground = sc.ground === 'dark' ? 'light' : 'dark';
  }
  if (r.format) s.format = r.format;
  if (r.style) { s.style = r.style; s.accentStyle = STYLES[r.style].accentStyle; }
  if (r.mood) s.music = { ...s.music, mood: r.mood, bpm: undefined };
  if (r.accent) s.palette = { ...(s.palette || STYLES[s.style].palette), accent: r.accent };
  if (r.shorter) s.scenes = s.scenes.filter((x, i) => i === 0 || i === s.scenes.length - 1 || !['quote', 'grid', 'justify'].includes(x.type)).map((x) => ({ ...x, beats: Math.max(3, (x.beats || 6) - 1) }));
  if (r.longer) s.scenes.forEach((x) => { x.beats = Math.min(10, (x.beats || 6) + 1); });
  if (r.duration) s.scenes = fitDuration(s.scenes, r, MOODS[s.music?.mood || 'drive'].bpm);
  if (r.darker) s.scenes.forEach((x, i) => { if (x.ground === 'light' && i % 2) x.ground = 'dark'; });
  if (r.lighter) s.scenes.forEach((x, i) => { if (x.ground === 'dark' && i % 2) x.ground = 'light'; });
  return s;
}
