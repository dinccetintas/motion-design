// Film player for the studio and the landing page. Same engine as the renderer:
// film.seek(t) paints a frame; the audio clock is the master clock while playing.
import { Film } from '/engine/film.js';

const images = new Map();
function loadImage(src) {
  if (!images.has(src)) images.set(src, new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  return images.get(src);
}
let worker = null, wid = 0;
const pending = new Map();
function compose(spec) {
  if (!worker) {
    worker = new Worker('/js/score-worker.js', { type: 'module' });
    worker.onmessage = (e) => { const p = pending.get(e.data.id); pending.delete(e.data.id); if (p) e.data.error ? p.rej(new Error(e.data.error)) : p.res(e.data); };
  }
  const id = ++wid;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); worker.postMessage({ id, spec }); });
}

export class Player extends EventTarget {
  /** canvas: target; opts: { audio: bool, loop: bool, fit: element whose box the canvas fits } */
  constructor(canvas, opts = {}) {
    super();
    this.canvas = canvas; this.opts = { audio: true, loop: true, ...opts };
    this.film = null; this.t = 0; this.playing = false; this.muted = !!opts.muted;
    this.ac = null; this.src = null; this.gain = null; this.buffer = null; this._raf = 0; this._t0 = 0; this._wall0 = 0;
    this._scoreKey = null;
  }
  get duration() { return this.film?.duration || 0; }

  /** Load (or hot-swap) a spec. Keeps the playhead when the film is the same length or longer. */
  async load(spec) {
    const assets = {};
    await Promise.all(Object.entries(spec.assets || {}).map(async ([k, src]) => { assets[k] = await loadImage(src); }));
    const film = new Film(spec, this.canvas, assets, { scale: this.opts.scale || 1 });
    await film.load();
    const wasPlaying = this.playing;
    if (wasPlaying) this._stopAudio();
    this.film = film;
    this.t = Math.min(this.t, Math.max(0, film.duration - 0.01));
    this.draw();
    this.dispatchEvent(new CustomEvent('load', { detail: { duration: film.duration, timeline: film.timeline(), beat: film.beat } }));
    if (this.opts.audio) {
      const key = JSON.stringify([film.spec.music, film.timeline(), film.cues().length]);
      if (key !== this._scoreKey) {
        this._scoreKey = key; this.buffer = null;
        compose(film.spec).then((m) => {
          if (this._scoreKey !== key) return;
          this._ensureAC();
          const b = this.ac.createBuffer(2, m.L.length, m.sr); b.copyToChannel(m.L, 0); b.copyToChannel(m.R, 1);
          this.buffer = b;
          if (this.playing) this._startAudio();
          this.dispatchEvent(new Event('score'));
        }).catch((e) => console.warn('score', e));
      }
    }
    if (wasPlaying) this._startAudio();
    return film;
  }
  _ensureAC() {
    if (!this.ac) { this.ac = new AudioContext({ latencyHint: 'interactive' }); this.gain = this.ac.createGain(); this.gain.connect(this.ac.destination); this.gain.gain.value = this.muted ? 0 : 1; }
  }
  _startAudio() {
    if (!this.buffer || !this.opts.audio) return;
    this._ensureAC();
    this._stopAudio();
    this.src = this.ac.createBufferSource(); this.src.buffer = this.buffer; this.src.connect(this.gain);
    this.src.start(0, this.t);
    this._t0 = this.t; this._ac0 = this.ac.currentTime;
  }
  _stopAudio() { try { this.src?.stop(); } catch { /* already stopped */ } this.src = null; }

  now() {
    if (!this.playing) return this.t;
    if (this.src && this.ac) return this._t0 + (this.ac.currentTime - this._ac0);   // audio is the clock
    return this._t0 + (performance.now() - this._wall0) / 1000;
  }
  play() {
    if (!this.film || this.playing) return;
    if (this.t >= this.duration - 0.02) this.t = 0;
    this.playing = true;
    this._t0 = this.t; this._wall0 = performance.now();
    if (this.opts.audio) { this._ensureAC(); this.ac.resume(); this._startAudio(); }
    const tick = () => {
      if (!this.playing) return;
      let t = this.now();
      if (t >= this.duration) {
        if (this.opts.loop) { this.t = 0; this._t0 = 0; this._wall0 = performance.now(); if (this.src) this._startAudio(); t = 0; }
        else { this.t = this.duration - 0.001; this.pause(); this.draw(); return; }
      }
      this.t = t; this.draw();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
    this.dispatchEvent(new Event('play'));
  }
  pause() {
    if (!this.playing) return;
    this.t = this.now(); this.playing = false;
    cancelAnimationFrame(this._raf); this._stopAudio();
    this.dispatchEvent(new Event('pause'));
  }
  toggle() { this.playing ? this.pause() : this.play(); }
  seek(t) {
    this.t = Math.max(0, Math.min(t, Math.max(0, this.duration - 0.001)));
    if (this.playing) { this._t0 = this.t; this._wall0 = performance.now(); if (this.src) this._startAudio(); }
    this.draw();
  }
  mute(m) { this.muted = m; if (this.gain) this.gain.gain.value = m ? 0 : 1; }
  draw() { if (this.film) { this.film.seek(this.t); this.dispatchEvent(new CustomEvent('time', { detail: this.t })); } }
  destroy() { this.pause(); this.ac?.close(); }
}

/** Timecode mm:ss:ff at 30 fps. */
export const timecode = (t, fps = 30) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * fps);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
};

/** Render scene thumbnails (one per scene, at its settled moment) into small canvases. */
export async function thumbnails(spec, width = 120) {
  const c = document.createElement('canvas');
  const film = new Film(spec, c, {}, { scale: Math.max(0.15, (width * 2) / 1080) });
  const assets = {};
  await Promise.all(Object.entries(spec.assets || {}).map(async ([k, src]) => { assets[k] = await loadImage(src); }));
  film.assets = assets;
  await film.load();
  return film.timeline().map((s) => {
    film.seek(s.start + Math.min(s.dur * 0.75, s.dur - film.beat * 0.6));
    const t = document.createElement('canvas');
    t.width = width; t.height = Math.round(width * film.H / film.W);
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    return t;
  });
}

/** A small offscreen film for sampling frames: sampler.frame(t) paints t and returns its canvas. */
export async function sampler(spec, height = 220) {
  const c = document.createElement('canvas');
  const probe = new Film(spec, c, {}, { scale: 1 });
  const film = new Film(spec, c, {}, { scale: height / probe.H });
  const assets = {};
  await Promise.all(Object.entries(spec.assets || {}).map(async ([k, src]) => { assets[k] = await loadImage(src); }));
  film.assets = assets;
  await film.load();
  return { film, canvas: c, aspect: film.W / film.H, frame(t) { film.seek(t); return c; } };
}
