// The rail: scenes are frames strung on a perforated strip, one pitch per beat.
// Scrubbing moves the tape flag freely and settles on the beat grid when released.
import { thumbnails } from '/js/player.js';

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
      f.innerHTML = `<div class="cell"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="ttl">${s.type}</span></div>`;
      f.title = `Scene ${i + 1}: ${s.type}, ${s.beats} beats`;
      this.framesEl.appendChild(f);
      return f;
    });
    this.layout();
    if (this.sel >= 0) this.select(Math.min(this.sel, this.frames.length - 1), false);
    const key = JSON.stringify(spec.scenes) + spec.style + spec.format + JSON.stringify(spec.palette || {});
    this._thumbKey = key;
    const thumbs = await thumbnails(spec, 160).catch(() => []);
    if (this._thumbKey !== key) return;
    thumbs.forEach((c, i) => this.frames[i]?.querySelector('.cell').prepend(c));
  }

  setMarks(marks) {
    this.marks = marks;
    this.frames?.forEach((f, i) => { f.classList.remove('ok', 'issue'); if (marks[i]) f.classList.add(marks[i]); });
  }

  layout() {
    if (!this.tl.length) return;
    const beats = this.tl.reduce((a, s) => a + s.beats, 0);
    const avail = this.scroll.clientWidth - 40;
    this.pitch = Math.max(14, avail / beats);
    const width = beats * this.pitch;
    this.inner.style.width = width + 'px';
    this.frames.forEach((f, i) => { f.style.width = this.tl[i].beats * this.pitch + 'px'; });
    // Ruler: a tick per beat, a long tick and number per bar.
    const frag = document.createDocumentFragment();
    for (let b = 0; b <= beats; b++) {
      const t = document.createElement('i'); t.style.left = b * this.pitch + 'px';
      if (b % 4 === 0) { t.className = 'bar'; const n = document.createElement('b'); n.style.left = b * this.pitch + 'px'; n.textContent = String(b / 4 + 1); frag.appendChild(n); }
      frag.appendChild(t);
    }
    this.ruler.replaceChildren(frag);
    this.setTime(this._t || 0);
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
    return Math.max(0, Math.min(this.duration - 0.001, ((clientX - r.left) / this.pitch) * this.beat));
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
