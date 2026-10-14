// Landing: the hero rail cuts a showcase film live; the reel plays from the same engine.
import { Player, thumbnails, timecode } from '/js/player.js';

const $ = (s, el = document) => el.querySelector(s);
const AR = { '9:16': '9 / 16', '16:9': '16 / 9', '1:1': '1 / 1', '4:5': '4 / 5' };
const AXES = ['hook', 'readability', 'motion', 'variety', 'brand', 'sync'];

const CREW = [
  ['Researcher', 'Reads your link, article or topic. Captures the real page, its colors, fonts and logo; finds numbers worth saying; searches the web for a topic.', 'stripe.com → accent #533AFD, 9 numbers'],
  ['Writer', 'Finds the one idea a viewer could repeat, then writes a hook that lands in two seconds and copy short enough to read on the beat.', 'Hook: “Your idea. Cut.”'],
  ['Art director', 'Chooses the world: one display face, one text face, one accent, three grounds, and the music that fits the audience.', 'Tall Poster • Drive • 9:16'],
  ['Director', 'Blocks the film on the beat grid: scene types, timing, grounds, transitions. Uses your real screenshots and only true facts.', '8 scenes • 24.5 s • 120 bpm'],
  ['Composer', 'Composes an original score for the cut, locks every hit to a transition, and masters it to −14 LUFS.', 'Drive in A minor, kick on the grid'],
  ['Critic', 'Renders a contact sheet, probes every word on every frame, scores the cut and sends the worst three problems back.', 'Readability 6.9 → 8.4 after one pass'],
];

async function api(path, opts) { const r = await fetch(path, opts); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); return r.json(); }

// ---- Composer: start a real project -------------------------------------------------
for (const form of document.querySelectorAll('form.composer')) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ta = form.querySelector('textarea'), btn = form.querySelector('button[type=submit]');
    const message = ta.value.trim();
    if (!message) { ta.focus(); return; }
    btn.disabled = true; btn.textContent = 'Calling the crew';
    try { const { id } = await api('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }); location.href = `/studio#${id}`; }
    catch { location.href = '/studio?brief=' + encodeURIComponent(message); }
  });
  form.querySelector('textarea').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
}
for (const b of document.querySelectorAll('.try')) b.addEventListener('click', () => { const ta = $('#hero-input'); ta.value = b.dataset.try; ta.focus(); });

// ---- Crew ------------------------------------------------------------------------------
$('#crew-list').innerHTML = CREW.map(([role, what, sample]) => `
  <li><span class="pin" aria-hidden="true"></span><div class="trim"><h3 class="role cond">${role}</h3><p>${what}</p><p class="sample">${sample}</p></div></li>`).join('');

// ---- Showcase data ------------------------------------------------------------------------
const reel = await api('/api/showcase').catch(() => []);

// ---- Measured table --------------------------------------------------------------------------
if (reel.length) {
  const cell = (v) => `<span class="n${v < 8 ? ' low' : ''}" role="cell">${v.toFixed(1)}</span>`;
  $('#measure-table').innerHTML = `<div class="mrow head label" role="row"><span role="columnheader">Film</span>${AXES.map((a) => `<span class="n label" role="columnheader">${a}</span>`).join('')}<span class="n label" role="columnheader">all</span></div>` +
    reel.map((f) => `<div class="mrow" role="row"><span class="film" role="cell">${f.title}</span>${AXES.map((a) => cell(f.qa.scores[a])).join('')}<span class="n all" role="cell">${f.qa.overall.toFixed(1)}</span></div>`).join('') +
    `<p class="measure-note">Scores are the critic's measurements on the final cut: hook energy in the first two seconds, word size and contrast at phone size, motion between beats, variety of scenes, brand accuracy, and motion onsets against the music's beat grid.</p>`;
}

// ---- Hero rail -------------------------------------------------------------------------------
const hero = reel.find((f) => f.hero) || reel[0];
if (hero) {
  const strip = $('#hero-strip');
  const track = document.createElement('div'); track.className = 'strip-track'; strip.appendChild(track);
  const live = document.createElement('canvas');
  const player = new Player(live, { audio: true, muted: true, loop: true, scale: 0.6 });
  await player.load(hero.spec);
  const thumbs = await thumbnails(hero.spec, 180);
  const tl = player.film.timeline();
  $('#hero-title').textContent = hero.title;
  const cells = tl.map((s, i) => {
    const c = document.createElement('div'); c.className = 'frame-cell'; c.style.setProperty('--ar', AR[hero.spec.format] || '9 / 16');
    c.appendChild(thumbs[i]); c.insertAdjacentHTML('beforeend', `<span class="num">${String(i + 1).padStart(2, '0')}</span>`);
    track.appendChild(c); return c;
  });
  // Ruler: one tick per beat.
  $('#hero-ruler').style.setProperty('--pitch', `${Math.max(8, strip.clientWidth / (player.duration / player.film.beat))}px`);
  let active = -1;
  const setActive = (i) => {
    if (i === active) return;
    if (active >= 0) { cells[active].classList.remove('active'); cells[active].replaceChildren(thumbs[active], ...[...cells[active].querySelectorAll('.num')]); cells[active].classList.add('done'); }
    active = i;
    cells[i].classList.add('active'); cells[i].classList.remove('done');
    cells[i].prepend(live);
    if (i === 0) cells.forEach((c) => c.classList.remove('done'));
    requestAnimationFrame(() => {
      const r = cells[i].offsetLeft + cells[i].offsetWidth / 2;
      track.style.transition = 'transform 640ms cubic-bezier(0.23, 1, 0.32, 1)';
      track.style.transform = `translateX(${-r}px)`;
    });
  };
  player.addEventListener('time', (e) => {
    const t = e.detail;
    let i = tl.findIndex((s) => t >= s.start && t < s.start + s.dur); if (i < 0) i = tl.length - 1;
    setActive(i);
    $('#hero-tc').textContent = timecode(t);
  });
  setActive(0);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) player.play(); else { player.seek(1.2); }
  const snd = $('#hero-sound');
  snd.addEventListener('click', () => {
    const on = snd.getAttribute('aria-pressed') !== 'true';
    snd.setAttribute('aria-pressed', String(on)); snd.textContent = on ? 'Sound on' : 'Sound off';
    player.mute(!on); if (on) { player.ac?.resume(); if (!player.playing) player.play(); }
  });
  // Only spend frames while the hero is on screen.
  new IntersectionObserver(([en]) => { if (en.isIntersecting) { if (!reduce) player.play(); } else player.pause(); }, { threshold: 0.15 }).observe(strip);
}

// ---- Showreel ----------------------------------------------------------------------------------
const grid = $('#reel-grid');
const players = [];
for (const f of reel) {
  const fig = document.createElement('article');
  const [aw, ah] = f.spec.format.split(':').map(Number);
  fig.className = 'reel-item';
  fig.style.setProperty('--arn', String(aw / ah));
  const pass = Object.values(f.qa.scores).every((v) => v >= 8);
  fig.innerHTML = `<div class="win"><canvas></canvas><span class="play-state mono">${f.spec.format}</span></div>
    <div class="meta"><h3 class="cond">${f.title}</h3><a class="tab small ghost" href="/studio?showcase=${encodeURIComponent(f.id)}">Remix</a></div>
    <p class="from">Made from ${f.from}</p>
    <p class="verdict">${pass ? '<span class="cross" aria-hidden="true"></span>' : ''}<span class="mono">${f.qa.overall.toFixed(1)}</span><span class="dim">${pass ? 'every axis 8 or above' : 'in review'}</span></p>`;
  grid.appendChild(fig);
  const p = new Player(fig.querySelector('canvas'), { audio: false, loop: true, scale: f.spec.format === '16:9' ? 0.5 : 0.4 });
  p.load(f.spec).then(() => p.seek(Math.min(1.5, p.duration / 3)));
  players.push({ el: fig, p, ratio: 0 });
}
// One reel film plays at a time: the most visible one.
const io = new IntersectionObserver((entries) => {
  for (const en of entries) { const it = players.find((x) => x.el === en.target); if (it) it.ratio = en.isIntersecting ? en.intersectionRatio : 0; }
  const best = players.reduce((a, b) => (b.ratio > (a?.ratio ?? 0) ? b : a), null);
  for (const it of players) { if (it === best && it.ratio > 0.35) it.p.play(); else it.p.pause(); }
}, { threshold: [0, 0.35, 0.6, 0.9] });
players.forEach((it) => io.observe(it.el));
