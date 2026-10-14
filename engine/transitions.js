// Transitions between two scenes. Each one is drawn with clipping and transforms only,
// so no offscreen buffers are needed and every frame stays a pure function of time.
// win(beat) -> [pre, post] seconds around the cut; the visual "hit" lands on the cut.
import { clamp, ease, lerp } from './core.js';

const dirVec = (dir) => ({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir] || [1, 0]);

export const TRANSITIONS = {
  cut: { win: () => [0, 0], draw: (g, p, A, B) => (p < 1 ? A() : B()) },

  // Hard-edged reveal of B over A.
  wipe: {
    win: (b) => [b * 0.5, b * 0.25],
    draw(g, p, A, B, o) {
      const e = ease.inOutQuart(p), [dx, dy] = dirVec(o.dir || 'left');
      A(); g.save();
      const { W, H } = g;
      if (dx) { const w = W * e; g.ctx.beginPath(); g.ctx.rect(dx < 0 ? W - w : 0, 0, w, H); }
      else { const h = H * e; g.ctx.beginPath(); g.ctx.rect(0, dy < 0 ? H - h : 0, W, h); }
      g.ctx.clip(); B(); g.restore();
    },
  },

  // A slab of color sweeps across; B is revealed behind its trailing edge.
  panel: {
    win: (b) => [b * 0.6, b * 0.6],
    draw(g, p, A, B, o) {
      const { W, H, ctx } = g, [dx, dy] = dirVec(o.dir || 'up');
      const span = dx ? W : H, slab = span * 0.55;
      const lead = ease.inOutCubic(p) * (span + slab), trail = lead - slab;
      A();
      const band = (a, b) => {   // region from a to b along the travel axis, in travel direction
        a = clamp(a, 0, span); b = clamp(b, 0, span); if (b <= a) return null;
        ctx.beginPath();
        if (dx > 0) ctx.rect(a, 0, b - a, H); else if (dx < 0) ctx.rect(W - b, 0, b - a, H);
        else if (dy > 0) ctx.rect(0, a, W, b - a); else ctx.rect(0, H - b, W, b - a);
        return true;
      };
      g.save(); if (band(0, trail)) { ctx.clip(); B(); } g.restore();
      g.save(); if (band(trail, lead)) { ctx.fillStyle = o.color; ctx.fill(); } g.restore();
    },
  },

  // Circle grows from a point.
  iris: {
    win: (b) => [b * 0.5, b * 0.3],
    draw(g, p, A, B, o) {
      const { W, H, ctx } = g, cx = (o.x ?? 0.5) * W, cy = (o.y ?? 0.5) * H;
      const r = ease.inOutExpo(p) * Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
      A(); g.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.01, r), 0, Math.PI * 2); ctx.clip(); B(); g.restore();
      if (p > 0 && p < 1) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = o.color; ctx.lineWidth = g.u * 1.6 * (1 - p); ctx.stroke(); }
    },
  },

  // Shutter: bands wipe in with stagger, alternating direction.
  slice: {
    win: (b) => [b * 0.6, b * 0.4],
    draw(g, p, A, B, o) {
      const { W, H, ctx } = g, n = o.n || 5, vertical = H > W;
      A();
      for (let i = 0; i < n; i++) {
        const q = ease.inOutQuart(clamp(p * 1.6 - i * (0.6 / (n - 1))));
        if (q <= 0) continue;
        g.save(); ctx.beginPath();
        if (vertical) { const bh = H / n, w = W * q; ctx.rect(i % 2 ? W - w : 0, i * bh, w, bh + 1); }
        else { const bw = W / n, h = H * q; ctx.rect(i * bw, i % 2 ? H - h : 0, bw + 1, h); }
        ctx.clip(); B(); g.restore();
      }
    },
  },

  // Camera push: A leaves, B arrives, both moving.
  push: {
    win: (b) => [b * 0.45, b * 0.35],
    draw(g, p, A, B, o) {
      const { W, H, ctx } = g, [dx, dy] = dirVec(o.dir || 'left'), e = ease.inOutExpo(p);
      g.save(); ctx.translate(dx * W * e, dy * H * e); A(); g.restore();
      g.save(); ctx.translate(dx * W * (e - 1), dy * H * (e - 1)); B(); g.restore();
    },
  },

  // B rises as a card over A, which recedes.
  stack: {
    win: (b) => [b * 0.5, b * 0.4],
    draw(g, p, A, B, o) {
      const { W, H, ctx } = g, e = ease.inOutQuart(p);
      g.save(); const s = 1 - 0.08 * e; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); A(); g.restore();
      ctx.fillStyle = `rgba(0,0,0,${0.45 * e})`; ctx.fillRect(0, 0, W, H);
      const y = H * (1 - e), r = g.u * 5 * (1 - e);
      g.save(); ctx.beginPath(); ctx.roundRect(0, y, W, H, [r, r, 0, 0]); ctx.clip(); ctx.translate(0, y); B(); g.restore();
    },
  },

  // B grows from a small rounded window while A pushes past the camera.
  zoom: {
    win: (b) => [b * 0.5, b * 0.35],
    draw(g, p, A, B, o) {
      const { W, H, ctx } = g, e = ease.inOutExpo(p);
      g.save(); const s = 1 + 0.6 * e; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); A(); g.restore();
      const w = lerp(W * 0.04, W, e), h = lerp(W * 0.04, H, e), r = lerp(W * 0.02, 0, e);
      g.save(); ctx.beginPath(); ctx.roundRect((W - w) / 2, (H - h) / 2, w, h, r); ctx.clip();
      const s2 = lerp(0.85, 1, e); ctx.translate(W / 2, H / 2); ctx.scale(s2, s2); ctx.translate(-W / 2, -H / 2); B(); g.restore();
    },
  },

  // A splits like doors, B behind.
  split: {
    win: (b) => [b * 0.3, b * 0.5],
    draw(g, p, A, B, o) {
      const { W, H, ctx } = g, e = ease.inOutQuart(p), vertical = H > W;
      g.save(); const s = 1.08 - 0.08 * e; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); B(); g.restore();
      for (const side of [-1, 1]) {
        g.save(); ctx.beginPath();
        if (vertical) { ctx.rect(0, side < 0 ? 0 : H / 2, W, H / 2); ctx.clip(); ctx.translate(0, side * H / 2 * e); }
        else { ctx.rect(side < 0 ? 0 : W / 2, 0, W / 2, H); ctx.clip(); ctx.translate(side * W / 2 * e, 0); }
        A(); g.restore();
      }
    },
  },
};

export const TRANSITION_NAMES = Object.keys(TRANSITIONS);
