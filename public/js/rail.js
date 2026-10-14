// The rail: scenes are frames strung on a perforated strip, one pitch per beat.
// Scrubbing moves the tape flag freely and settles on the beat grid when released.
import { sampler } from '/js/player.js';

export class Rail extends EventTarget {
  constructor(root) {
    super();
    this.scroll = root.querySelector('#rail-scroll');
    this.inner = root.querySelector('#rail-inner');
    this.ruler = root.querySelector('#rail-ruler');
    this.framesEl = root.querySelector('#rail-frames');
    this.head = root.querySelector('#playhead');
    this.tl = []; this.beat = 0.5; this.duration = 0; this.pitch = 20; this.sel = -1;
    this._bind();
    new ResizeObserver(() => this.layout()).observe(this.scroll);
  }

  /** Rebuild from a film timeline. marks: { [sceneIndex]: 'ok' | 'issue' } */
  async build(spec, timeline, beat, duration, marks = {}) {
    this.tl = timeline; this.beat = beat; this.duration = duration; this.marks = marks;
    this.framesEl.replaceChildren();
    this.frames = timeline.map((s, i) => {
      const f = document.createElement('div');
      f.className = 'rframe' + (marks[i] ? ' ' + marks[i] : '');
      f.dataset.i = i;
      f.innerHTML = `<div class="cell"><canvas></canvas></div><span class="ttl"><span>${s.type}</span><i class="mark"></i></span>`;
      this.framesEl.appendChild(f);
      this._markTitle(f, i);
      return f;
    });
    this.layout();
    if (this.sel >= 0) this.select(Math.min(this.sel, this.frames.length - 1), false);
    const key = JSON.stringify(spec.scenes) + spec.style + spec.format + JSON.stringify(spec.palette || {});
    this._thumbKey = key;
    const smp = await sampler(spec).catch(() => null);
    if (this._thumbKey !== key || !smp) return;
    this._smp = smp;
    this.paint();
  }

  /** Paint each cell as a strip of real frames at the film's aspect, sampled across the scene. */
  paint() {
    const smp = this._smp; if (!smp || !this.frames) return;
    const dpr = Math.min(2, devicePixelRatio || 1), gap = 2;
    this.frames.forEach((f, i) => {
      const s = this.tl[i], cv = f.querySelector('.cell canvas');
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const x = cv.getContext('2d');
      x.scale(dpr, dpr);
      x.fillStyle = '#0A0A0A'; x.fillRect(0, 0, w, h);
      const fw = h * smp.aspect;
      const n = Math.max(1, Math.floor((w + gap) / (fw + gap)));
      const used = n * fw + (n - 1) * gap, x0 = n === 1 ? (w - fw) / 2 : (w - used) / 2;
      for (let k = 0; k < n; k++) {
        // One frame: the settled moment. Several: the scene unfolding, entrance to hold.
        const t = n === 1 ? s.start + Math.min(s.dur * 0.75, s.dur - this.beat * 0.6) : s.start + s.dur * (0.12 + 0.82 * k / (n - 1));
        x.drawImage(smp.frame(Math.min(t, this.duration - 0.001)), x0 + k * (fw + gap), 0, fw, h);
      }
    });
  }

  setMarks(marks) {
    this.marks = marks;
    this.frames?.forEach((f, i) => { f.classList.remove('ok', 'issue'); if (marks[i]) f.classList.add(marks[i]); this._markTitle(f, i); });
  }

  _markTitle(f, i) {
    const m = this.marks?.[i], el = f.querySelector('.mark');
    el.title = m === 'ok' ? 'Approved by the critic' : m === 'issue' ? 'The critic flagged this scene' : '';
    const s = this.tl[i];
    f.title = `Scene ${i + 1}: ${s.type}, ${s.beats} beats${el.title ? ' • ' + el.title : ''}`;
  }

  layout() {
    if (!this.tl.length) return;
    const beats = this.tl.reduce((a, s) => a + s.beats, 0);
    const avail = this.scroll.clientWidth - 76;   // scroll padding and inner padding
    this.pitch = Math.max(11, avail / beats);   // fit the whole film when it can; labels shrink to suit
    const width = beats * this.pitch;
    this.inner.style.width = width + 'px';
    this.frames.forEach((f, i) => { f.style.width = this.tl[i].beats * this.pitch + 'px'; });
    // Labels shrink to fit their cell before they ever truncate.
    for (const f of this.frames) {
      const t = f.querySelector('.ttl span'); t.style.fontSize = ''; f.classList.remove('tight');
      const shrink = () => { for (let px = 11; px > 8.5 && t.scrollWidth > t.clientWidth; px -= 0.5) t.style.fontSize = px + 'px'; };
      shrink();
      // Still too long: the name wins over the mark (the verdict stays in the tooltip and the Review tab).
      if (t.scrollWidth > t.clientWidth) { f.classList.add('tight'); t.style.fontSize = ''; shrink(); }
    }
    // Ruler: a tick per beat, a long tick and number per bar.
    const frag = document.createDocumentFragment();
    for (let b = 0; b <= beats; b++) {
      const t = document.createElement('i'); t.style.left = b * this.pitch + 'px';
      if (b % 4 === 0) { t.className = 'major'; const n = document.createElement('b'); n.style.left = b * this.pitch + 'px'; n.textContent = String(b / 4 + 1); frag.appendChild(n); }
      frag.appendChild(t);
    }
    this.ruler.replaceChildren(frag);
    this.setTime(this._t || 0);
    clearTimeout(this._pt); this._pt = setTimeout(() => this.paint(), 80);
  }

  setTime(t) {
    this._t = t;
    const x = (t / this.beat) * this.pitch;
    this.head.style.transform = `translateX(${x}px)`;
    // Keep the playhead in view while playing.
    const sx = this.scroll.scrollLeft, w = this.scroll.clientWidth;
    if (!this._drag && (x < sx + 20 || x > sx + w - 60)) this.scroll.scrollLeft = Math.max(0, x - w * 0.3);
  }

  select(i, emit = true) {
    this.sel = i;
    this.frames?.forEach((f, k) => f.classList.toggle('sel', k === i));
    if (emit) this.dispatchEvent(new CustomEvent('select', { detail: i }));
  }

  _timeAt(clientX) {
    const r = this.inner.getBoundingClientRect();
    return Math.max(0, Math.min(this.duration - 0.001, ((clientX - r.left - 18) / this.pitch) * this.beat));
  }
  _bind() {
    let startX = 0, moved = false;
    this.inner.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this._drag = true; moved = false; startX = e.clientX;
      this.inner.setPointerCapture(e.pointerId);
      this.dispatchEvent(new CustomEvent('scrub', { detail: { t: this._timeAt(e.clientX), phase: 'start' } }));
    });
    this.inner.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      if (Math.abs(e.clientX - startX) > 3) moved = true;
      this.dispatchEvent(new CustomEvent('scrub', { detail: { t: this._timeAt(e.clientX), phase: 'move' } }));
    });
    const end = (e) => {
      if (!this._drag) return;
      this._drag = false;
      const t = this._timeAt(e.clientX);
      // Settle on the beat grid, never between beats.
      const snapped = Math.round(t / this.beat) * this.beat;
      this.dispatchEvent(new CustomEvent('scrub', { detail: { t: Math.min(snapped, this.duration - 0.001), phase: 'end' } }));
      if (!moved) {
        const f = document.elementFromPoint(e.clientX, e.clientY)?.closest('.rframe');
        if (f) this.select(+f.dataset.i);
      }
    };
    this.inner.addEventListener('pointerup', end);
    this.inner.addEventListener('pointercancel', end);
  }
}
