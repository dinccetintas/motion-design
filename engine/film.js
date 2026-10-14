// Film: compiles a FilmSpec into a beat-locked timeline and paints any time t.
// The contract: film.seek(t) draws frame t, with no state carried between frames.
import { Gfx } from './gfx.js';
import { resolveStyle } from './styles.js';
import { SCENES } from './scenes/index.js';
import { TRANSITIONS } from './transitions.js';
import { clamp, hash, rng } from './core.js';
import { MOODS } from './audio/score.js';

export const FORMATS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

/** Fill defaults so every downstream consumer sees a complete, valid spec. */
export function normalize(spec) {
  const s = JSON.parse(JSON.stringify(spec || {}));
  s.format = FORMATS[s.format] ? s.format : '9:16';
  s.style = s.style || 'swiss';
  s.music = { mood: 'drive', seed: 1, ...(s.music || {}) };
  if (!MOODS[s.music.mood]) s.music.mood = 'drive';
  s.music.bpm = clamp(Number(s.music.bpm) || MOODS[s.music.mood].bpm, 70, 160);
  s.scenes = (s.scenes || []).filter((sc) => SCENES[sc.type]);
  const pattern = ['dark', 'light', 'dark', 'accent', 'light', 'dark'];
  s.scenes.forEach((sc, i) => {
    sc.props = sc.props || {};
    sc.beats = clamp(Math.round(sc.beats || SCENES[sc.type].beats || 4), 2, 16);
    sc.ground = ['dark', 'light', 'accent'].includes(sc.ground) ? sc.ground : pattern[i % pattern.length];
    if (i === 0) sc.transition = { type: 'cut' };
    else if (typeof sc.transition === 'string') sc.transition = { type: sc.transition };
    sc.transition = sc.transition && TRANSITIONS[sc.transition.type] ? sc.transition : { type: 'cut' };
  });
  return s;
}

/** Beat-locked timeline for a spec. Pure: runs in Node and browsers. */
export function plan(input) {
  const spec = normalize(input), beat = 60 / spec.music.bpm;
  let t = 0;
  const scenes = spec.scenes.map((sc, i) => {
    const dur = sc.beats * beat;
    const r = { ...sc, i, start: t, dur, end: t + dur, def: SCENES[sc.type], seed: (spec.music.seed || 1) * 977 + i * 131 };
    t += dur;
    return r;
  });
  return { spec, beat, scenes, duration: t + (spec.tail ?? 0) };
}

/** Sound cues in absolute seconds: scene cues + a sweep or hit on every transition. */
export function planCues(P) {
  const out = [];
  for (const s of P.scenes) {
    const S = { ...s, beat: P.beat };
    for (const c of (s.def.cues ? s.def.cues(s.props, S) : [])) out.push({ ...c, t: s.start + c.t });
    if (s.i > 0) {
      const tt = s.transition.type, [pre] = TRANSITIONS[tt].win(P.beat);
      if (tt === 'cut') out.push({ t: s.start, sfx: 'thump', gain: 0.55 });
      else out.push({ t: s.start - pre, sfx: 'whoosh', gain: 0.5, dur: pre + 0.15 });
    }
  }
  return out.filter((c) => c.t >= 0 && c.t < P.duration).sort((a, b) => a.t - b.t);
}

export class Film {
  /** opts.scale: preview resolution factor (renders always use 1). */
  constructor(spec, canvas, assets = {}, opts = {}) {
    const P = plan(spec);
    this.scale = opts.scale || 1;
    this.plan = P;
    this.spec = P.spec;
    const [W, H] = FORMATS[this.spec.format];
    this.W = W; this.H = H;
    this.canvas = canvas;
    const cw = Math.round(W * this.scale), ch = Math.round(H * this.scale);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    this.ctx = canvas.getContext('2d');
    this.style = resolveStyle(this.spec.style, this.spec);
    this.g = new Gfx(this.ctx, W, H, this.style);
    this.assets = assets;          // { key: HTMLImageElement | ImageBitmap }
    this.beat = P.beat;
    this.scenes = P.scenes;
    this.duration = P.duration;
    this._grain = null;
  }

  /** Fonts the style needs, loaded before the first frame. */
  async load() {
    const f = this.style.fonts, ps = [];
    for (const role of ['display', 'text', 'mono']) {
      const ff = f[role];
      for (const st of ['', 'italic ']) ps.push(document.fonts.load(`${st}${ff.weight} 64px "${ff.family}"`, 'AaĞğŞş'));
      ps.push(document.fonts.load(`400 64px "${ff.family}"`), document.fonts.load(`700 64px "${ff.family}"`));
    }
    await Promise.all(ps.map((p) => p.catch(() => null)));
    await document.fonts.ready;
  }

  sceneAt(t) {
    const sc = this.scenes;
    for (let i = sc.length - 1; i >= 0; i--) if (t >= sc[i].start) return i;
    return 0;
  }

  /** Paint scene i at absolute time t (scene may be drawn past its end during a transition). */
  drawScene(i, t) {
    const s = this.scenes[i], g = this.g, ctx = this.ctx;
    if (!s) return;
    const lt = t - s.start;
    const gr = this.style.grounds[s.ground];
    g.save();
    g.bg(gr.bg);
    // Camera: a slow push for life. Never a cut-to-static.
    const cam = this.style.camera * (s.props.camera ?? 1);
    if (cam) {
      const k = 1 + cam * clamp(lt / Math.max(1, s.dur), 0, 1.3);
      ctx.translate(this.W / 2, this.H / 2); ctx.scale(k, k); ctx.translate(-this.W / 2, -this.H / 2);
    }
    const nx = this.scenes[i + 1];
    const exitAt = nx && nx.transition.type === 'cut' ? s.dur - this.beat * 0.5 : null;
    const S = { ...s, lt, beat: this.beat, ground: s.ground, colors: gr, assets: this.assets, film: this, brand: this.spec.brand || {}, exitAt, last: !nx };
    try { s.def.draw(g, s.props, lt, S); } catch (e) { console.error('scene', s.type, e); }
    g.restore();
  }

  /** Paint frame t. With probe=true, returns every text box drawn this frame. */
  seek(t, { probe = false } = {}) {
    const g = this.g, ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    g.probe = probe ? [] : null;
    t = clamp(t, 0, Math.max(0, this.duration - 1e-6));
    let i = this.sceneAt(t);
    // Is t inside the window of the next scene's incoming transition?
    const next = this.scenes[i + 1];
    let tr = null;
    if (next) {
      const T = TRANSITIONS[next.transition.type], [pre] = T.win(this.beat);
      if (t >= next.start - pre) tr = { a: i, b: i + 1, at: next.start, T, o: next.transition };
    }
    if (!tr && i > 0) {
      const cur = this.scenes[i], T = TRANSITIONS[cur.transition.type], [, post] = T.win(this.beat);
      if (t < cur.start + post) tr = { a: i - 1, b: i, at: cur.start, T, o: cur.transition };
    }
    if (tr && tr.T !== TRANSITIONS.cut) {
      const [pre, post] = tr.T.win(this.beat);
      const p = clamp((t - (tr.at - pre)) / (pre + post));
      const color = tr.o.color || this.panelColor(tr.a, tr.b);
      tr.T.draw(g, p, () => this.drawScene(tr.a, t), () => this.drawScene(tr.b, t), { ...tr.o, color });
    } else this.drawScene(i, t);
    this.grain(t);
    const out = g.probe; g.probe = null;
    return out;
  }

  /** A transition panel uses whichever ground neither scene is on, accent first. */
  panelColor(a, b) {
    const ga = this.scenes[a].ground, gb = this.scenes[b].ground, G = this.style.grounds;
    for (const k of ['accent', 'dark', 'light']) if (k !== ga && k !== gb) return G[k].bg;
    return G.accent.bg;
  }

  grain(t) {
    const amt = this.style.grain * (this.spec.grain ?? 1);
    if (!amt) return;
    if (!this._grain) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d'), img = x.createImageData(256, 256), r = rng(7);
      for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      x.putImageData(img, 0, 0);
      this._grain = this.ctx.createPattern(c, 'repeat');
    }
    const f = Math.floor(t * 24), ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amt;
    ctx.translate(Math.floor(hash(f, 1) * 256), Math.floor(hash(f, 2) * 256));
    ctx.fillStyle = this._grain; ctx.fillRect(-256, -256, this.W + 512, this.H + 512);
    ctx.restore();
  }

  cues() { return planCues(this.plan); }

  /** Timeline summary for UIs and validators. */
  timeline() {
    return this.scenes.map((s) => ({ i: s.i, type: s.type, start: s.start, dur: s.dur, beats: s.beats, ground: s.ground, transition: s.transition.type }));
  }
}

export { SCENES, TRANSITIONS };
