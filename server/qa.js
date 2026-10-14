// Automated film critic: measures a spec's rendered frames and scores it 1-10 on the
// studio's six axes (CLAUDE.md): hook, readability, motion, variety, brand, sound sync.
// Every issue names a scene and a concrete fix, so a director (human or model) can act on it.
import { openFilm, contactSheet } from './renderer.js';
import { plan, planCues } from '../engine/film.js';
import { parseRich } from '../engine/gfx.js';

const HOOK_TYPES = new Set(['title', 'tunnel', 'justify', 'counter', 'marquee', 'grid', 'swap']);
const clamp10 = (v) => Math.max(1, Math.min(10, Math.round(v * 10) / 10));

/** Words a viewer must read in a scene (copy fields only). */
function sceneWords(sc) {
  const p = sc.props || {}, parts = [];
  for (const k of ['text', 'sub', 'prefix', 'title', 'label', 'caption', 'tagline', 'value', 'center']) if (typeof p[k] === 'string') parts.push(p[k]);
  for (const k of ['items', 'lines', 'words']) if (Array.isArray(p[k])) for (const it of p[k]) parts.push(typeof it === 'string' ? it : `${it.label ?? ''} ${it.text ?? ''}`);
  if (p.left) parts.push(`${p.left.label ?? ''} ${p.left.value ?? ''}`);
  if (p.right) parts.push(`${p.right.label ?? ''} ${p.right.value ?? ''}`);
  if (p.author) parts.push(p.author);
  return parseRich(parts.join(' ')).length;
}

const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const area = (a) => (a.x1 - a.x0) * (a.y1 - a.y0);

/**
 * Analyze a spec. Returns { scores, overall, issues, metrics, sheet? }.
 * opts: { sheet: path to write a contact sheet, audio: { lufs, truePeak, aligned } }
 */
export async function analyze(spec, opts = {}) {
  const P = plan(spec);
  const { page, info } = await openFilm(spec);
  const issues = [];
  const add = (severity, axis, scene, msg, fix) => issues.push({ severity, axis, scene, msg, fix });
  let scan, texts;
  try {
    // Settled moment of each scene: late enough that motion has landed, before any exit.
    const settled = P.scenes.map((s) => +(s.start + Math.min(s.dur * 0.78, s.dur - P.beat * 0.6)).toFixed(3));
    texts = await page.evaluate((t) => window.qaText(t), settled);
    scan = await page.evaluate(() => window.qaScan(15, 72));
    if (info.missing?.length) add('major', 'brand', null, `Missing assets: ${info.missing.join(', ')}`, 'Provide the asset or switch the scene to a text-only type.');
  } finally { await page.close(); }

  const W = info.W, H = info.H, minDim = Math.min(W, H), portrait = H > W * 1.2;
  const safe = { x0: minDim * 0.07, x1: W - minDim * 0.07, y0: portrait ? H * 0.11 : minDim * 0.07, y1: portrait ? H * 0.86 : H - minDim * 0.07 };

  // ---- Readability -----------------------------------------------------------------
  let readPen = 0, smallest = Infinity, worstContrast = Infinity;
  texts.forEach(({ boxes }, si) => {
    const sc = P.scenes[si];
    const vis = boxes.filter((b) => {
      if (!b.clip) return true;
      return inter(b, b.clip) > area(b) * 0.6;     // mostly unclipped = actually visible
    });
    for (const b of vis) {
      const rel = b.size / minDim;
      smallest = Math.min(smallest, rel);
      if (rel < 0.028) { readPen += 1.2; add('major', 'readability', si, `"${b.text}" is ${Math.round(b.size)}px, unreadable on a phone.`, 'Shorten the copy so it can be set larger, or split it across two scenes.'); }
      else if (rel < 0.042) { readPen += 0.4; add('minor', 'readability', si, `"${b.text}" is small (${Math.round(b.size)}px).`, 'Fewer words in this scene lets the type grow.'); }
      if (!b.stroke) {
        worstContrast = Math.min(worstContrast, b.contrast);
        const need = rel > 0.06 ? 3 : 4.5;
        if (b.contrast < need * 0.66) { readPen += 1.5; add('major', 'readability', si, `"${b.text}" has contrast ${b.contrast}:1.`, 'Change the scene ground or the accent color for this scene.'); }
        else if (b.contrast < need) { readPen += 0.5; add('minor', 'readability', si, `"${b.text}" contrast ${b.contrast}:1 is below ${need}:1.`, 'Use a ground with stronger contrast.'); }
      }
      if (b.x0 < -2 || b.x1 > W + 2 || b.y0 < -2 || b.y1 > H + 2) {
        if (!['marquee', 'tunnel', 'justify'].includes(sc.type)) { readPen += 1.5; add('major', 'readability', si, `"${b.text}" runs off the frame.`, 'Shorten the copy.'); }
      } else if (portrait && (b.y0 < safe.y0 - 4 || b.y1 > safe.y1 + 4) && sc.type !== 'marquee' && sc.type !== 'grid') {
        readPen += 0.3; add('minor', 'readability', si, `"${b.text}" sits in the platform UI zone.`, 'Keep copy inside the safe area.');
      }
    }
    // Overlaps between different words.
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      if (a.text === b.text) continue;
      const ov = inter(a, b);
      if (ov > Math.min(area(a), area(b)) * 0.25 && !['marquee', 'tunnel'].includes(sc.type)) {
        readPen += 1; add('major', 'readability', si, `"${a.text}" overlaps "${b.text}".`, 'Reduce copy or change layout.');
      }
    }
    // Reading speed: ~3.3 words/sec for display copy.
    const words = sceneWords(sc), need = words / 3.3 + 0.4;
    if (need > sc.dur) { readPen += 1; add('major', 'readability', si, `${words} words in ${sc.dur.toFixed(1)}s is too fast to read.`, `Cut to ${Math.floor((sc.dur - 0.4) * 3.3)} words or give the scene ${Math.ceil(need / P.beat)} beats.`); }
  });
  const readability = clamp10(10 - readPen);

  // ---- Hook --------------------------------------------------------------------------
  const fps = scan.fps, E = scan.energy, STD = scan.std;
  const meanE = E.reduce((a, b) => a + b, 0) / E.length;
  const hookE = E.slice(1, fps * 2).reduce((a, b) => a + b, 0) / Math.max(1, fps * 2 - 1);
  let hook = 10;
  if (STD[0] < 6) { hook -= 2.5; add('major', 'hook', 0, 'Frame 0 is empty.', 'Start the first scene with type already entering at t=0.'); }
  if (STD[Math.round(fps * 0.5)] < 10) { hook -= 2; add('major', 'hook', 0, 'Nothing readable by 0.5s.', 'Open on a title or tunnel scene.'); }
  if (hookE < meanE * 0.8) { hook -= 1.5; add('minor', 'hook', 0, 'The first 2s move less than the rest of the film.', 'Open with a high-energy scene (title, tunnel, justify).'); }
  if (P.scenes[0] && !HOOK_TYPES.has(P.scenes[0].type)) { hook -= 1.5; add('minor', 'hook', 0, `Opening on "${P.scenes[0].type}" is a slow start.`, 'Open with title, tunnel, justify or counter.'); }
  if (P.scenes[0] && sceneWords(P.scenes[0]) > 7) { hook -= 1; add('minor', 'hook', 0, 'The hook has too many words.', 'Hook copy: 2-6 words.'); }

  // ---- Motion ------------------------------------------------------------------------
  let motion = 10, run = 0, longest = 0;
  const endHold = (P.scenes.at(-1)?.dur || 0) + 0.2;
  for (let i = 0; i < E.length; i++) {
    const t = i / fps;
    if (E[i] < 0.12 && t < P.duration - endHold) { run++; longest = Math.max(longest, run / fps); } else run = 0;
  }
  if (longest > 1.6) { motion -= Math.min(4, (longest - 1.6) * 2); add('major', 'motion', null, `A ${longest.toFixed(1)}s stretch where nothing moves.`, 'Shorten that scene or add a secondary motion (camera drift, drawn rule, counter).'); }
  else if (longest > 1.0) { motion -= 0.8; add('minor', 'motion', null, `${longest.toFixed(1)}s hold without motion.`, 'Tighten holds to under a second.'); }
  const alive = E.filter((e) => e >= 0.12).length / E.length;
  if (alive < 0.55) { motion -= 1.5; add('minor', 'motion', null, `Only ${Math.round(alive * 100)}% of frames have motion.`, 'Prefer scenes with continuous motion.'); }
  const transitions = P.scenes.slice(1).map((s) => s.transition.type);
  const cutShare = transitions.filter((t) => t === 'cut').length / Math.max(1, transitions.length);
  if (transitions.length >= 4 && cutShare > 0.6) { motion -= 1; add('minor', 'motion', null, 'Mostly hard cuts; transitions carry motion design.', 'Use panel, wipe, slice, push or zoom between key scenes.'); }

  // ---- Variety -----------------------------------------------------------------------
  let variety = 10;
  const types = P.scenes.map((s) => s.type), uniq = new Set(types).size;
  if (types.length >= 4 && uniq / types.length < 0.6) { variety -= 2; add('major', 'variety', null, `Only ${uniq} scene types across ${types.length} scenes.`, 'Swap repeats for counter, swap, justify, orbit or compare.'); }
  for (let i = 1; i < types.length; i++) if (types[i] === types[i - 1]) { variety -= 1.2; add('major', 'variety', i, `Two "${types[i]}" scenes in a row.`, 'Change one of them to a different scene type.'); }
  const grounds = P.scenes.map((s) => s.ground);
  for (let i = 2; i < grounds.length; i++) if (grounds[i] === grounds[i - 1] && grounds[i] === grounds[i - 2]) { variety -= 0.8; add('minor', 'variety', i, `Three ${grounds[i]} grounds in a row.`, 'Alternate dark / light / accent grounds.'); }
  if (transitions.length >= 5 && new Set(transitions).size < 3) { variety -= 1; add('minor', 'variety', null, 'Few transition types.', 'Use at least three different transitions.'); }
  for (const s of P.scenes) {
    if (s.dur > 4.6 && !['screen', 'quote', 'linechart', 'bars', 'timeline', 'code', 'endcard', 'swap', 'orbit', 'globe'].includes(s.type)) { variety -= 0.6; add('minor', 'variety', s.i, `Scene runs ${s.dur.toFixed(1)}s; something new should happen every 2-4s.`, `Trim to ${Math.round(4 / P.beat)} beats.`); }
    if (s.dur < 1.4) { variety -= 0.4; add('minor', 'variety', s.i, `Scene is only ${s.dur.toFixed(1)}s.`, 'Give it at least 3 beats.'); }
  }
  if (!['endcard'].includes(P.scenes.at(-1)?.type)) { variety -= 0.8; add('minor', 'variety', P.scenes.length - 1, 'The film does not close on a lockup.', 'End with an endcard scene.'); }

  // ---- Brand -------------------------------------------------------------------------
  let brand = 9;
  const b = P.spec.brand || {};
  const end = P.scenes.find((s) => s.type === 'endcard');
  if (b.name) {
    brand = 10;
    if (!end || !(end.props.name || '').toLowerCase().includes(String(b.name).toLowerCase().slice(0, 4))) { brand -= 2; add('major', 'brand', end?.i ?? null, 'The brand name is not in the closing lockup.', 'Endcard name should be the brand.'); }
    if (b.url && end && !end.props.url) { brand -= 1; add('minor', 'brand', end.i, 'The URL is missing from the endcard.', 'Add props.url.'); }
    if (b.logo && end && !end.props.logo) { brand -= 0.5; add('minor', 'brand', end.i, 'The logo is available but unused.', 'Set endcard props.logo.'); }
    if (Array.isArray(b.colors) && b.colors.length && !P.spec.palette) { brand -= 1.5; add('major', 'brand', null, 'Brand colors were found but the film uses stock palette.', 'Set spec.palette from brand.colors.'); }
    const shots = P.scenes.filter((s) => s.type === 'screen' && s.props.image);
    if (b.screenshot && !shots.length) { brand -= 1; add('minor', 'brand', null, 'A real screenshot exists but no screen scene uses it.', 'Add a screen scene with the screenshot.'); }
  }

  // ---- Sound sync --------------------------------------------------------------------
  // Motion onsets: local peaks of energy that clearly rise above their neighborhood.
  const onsets = [];
  for (let i = 2; i < E.length - 1; i++) {
    const loc = (E[i - 2] + E[i - 1]) / 2;
    if (E[i] > 0.6 && E[i] >= E[i + 1] && E[i] > loc * 1.8) onsets.push(i / fps);
  }
  const grid = P.beat / 2, tol = 1 / fps + 0.035;
  const onGrid = onsets.filter((t) => { const d = Math.abs(((t + grid / 2) % grid) - grid / 2); return d <= tol || Math.abs(d - grid) <= tol; }).length;
  const syncRatio = onsets.length ? onGrid / onsets.length : 1;
  let sync = 6 + 4 * syncRatio;
  const cues = planCues(P);
  if (cues.length < P.scenes.length) { sync -= 1; add('minor', 'sync', null, 'Few sound cues for the amount of motion.', 'Every scene change and hit should have a cue.'); }
  if (opts.audio) {
    const a = opts.audio;
    if (a.lufs != null && Math.abs(a.lufs + 14) > 1) { sync -= 1; add('major', 'sync', null, `Loudness ${a.lufs} LUFS (target -14).`, 'Re-run loudness normalization.'); }
    if (a.truePeak != null && a.truePeak > -0.9) { sync -= 0.5; add('minor', 'sync', null, `True peak ${a.truePeak} dBTP.`, 'Limit to -1 dBTP.'); }
    if (a.aligned === false) { sync -= 2; add('major', 'sync', null, 'Measured kicks are off the beat grid.', 'Check score timing.'); }
  }
  sync = clamp10(sync);

  const scores = { hook: clamp10(hook), readability, motion: clamp10(motion), variety: clamp10(variety), brand: clamp10(brand), sync };
  const overall = Math.round(Object.values(scores).reduce((a, b2) => a + b2, 0) / 6 * 10) / 10;
  const result = {
    scores, overall, pass: Object.values(scores).every((v) => v >= 8),
    issues: issues.sort((a, c) => (a.severity === 'major' ? 0 : 1) - (c.severity === 'major' ? 0 : 1)),
    metrics: { duration: +P.duration.toFixed(2), scenes: P.scenes.length, smallestTextRel: +smallest.toFixed(4), worstContrast, longestStatic: +longest.toFixed(2), alive: +alive.toFixed(2), motionOnsets: onsets.length, onGridRatio: +syncRatio.toFixed(2), hookEnergyRatio: +(hookE / (meanE || 1)).toFixed(2) },
  };
  if (opts.sheet) result.sheet = (await contactSheet(spec, opts.sheet)).path;
  return result;
}
