// Graphic scenes: generative systems and poster typography.
import { sp, ew, ease, clamp, alpha, lerp, track, hash, rng, TAU, noise1, bump } from '../core.js';
import { drawText } from '../kinetic.js';
import { palette, textOpts, splitV, exitAt, arr } from './util.js';

export const justify = {
  beats: 6,
  describe: 'Kinetic poster: 2-5 short lines, each scaled to the full width so sizes vary; lines slam in from alternating sides.',
  props: { lines: 'array of 2-5 short lines (1-3 words each); mark accent line with *x*' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, lines = arr(p.lines).slice(0, 5), ctx = g.ctx;
    const fits = lines.map((ln) => {
      const s = String(ln), accent = /\*/.test(s), txt = s.replace(/\*/g, '');
      g.font(100, 'display');
      const w = g.measure(txt);
      return { txt, accent, size: Math.min(100 * box.w / w, box.h * 0.4) };
    });
    const capK = g.style.fonts.display.capHeight ?? 0.72, gap = g.u * 2.2;
    let total = fits.reduce((a, f) => a + f.size * capK, 0) + gap * (fits.length - 1);
    const scale = total > box.h ? box.h / total : 1;
    total *= scale;
    let y = box.y + (box.h - total) / 2;
    fits.forEach((f, i) => {
      const size = f.size * scale, capH = size * capK;
      y += capH;
      const t0 = i * S.beat * 0.5, dir = i % 2 ? 1 : -1;
      const pr = sp(lt - t0, 'snap'), ex = sp(lt - ((exitAt(S) ?? 1e9) + i * 0.04), 'snap');
      g.font(size, 'display');
      const w = g.measure(f.txt);
      const x = box.x + (box.w - w) / 2 + (1 - pr) * dir * g.W + ex * -dir * g.W;
      g.save(); g.clipRect(0, y - capH - size * 0.1, g.W, capH + size * 0.2);
      if (f.accent) {
        const bp = ew(lt, t0 + 0.15, 0.4);
        g.rect(box.x - g.u * 1.5, y - capH - size * 0.06, (box.w + g.u * 3) * bp, capH + size * 0.12, P.hilite);
        g.text(f.txt, x, y, P.ground === 'accent' ? P.bg : g.style.grounds.accent.ink);
      } else g.text(f.txt, x, y, P.ink);
      g.restore();
      y += gap * scale;
    });
  },
  cues(p, S) { return arr(p.lines).map((_, i) => ({ t: i * S.beat * 0.5, sfx: 'thump', gain: 0.45 })); },
};

export const grid = {
  beats: 6,
  describe: 'A grid of shapes ripples from one corner: squares become circles, rotate, then flood the frame. Optional word on top. A pure motion moment.',
  props: { text: 'optional 1-3 words that rise over the pattern' },
  draw(g, p, lt, S) {
    const P = palette(g, S), ctx = g.ctx, b = S.beat;
    const cols = g.landscape ? 10 : 6, cell = g.W / cols, rows = Math.ceil(g.H / cell) + 1;
    const ox = g.W * 0.12, oy = g.H * 0.88, maxD = Math.hypot(g.W, g.H);
    const col = P.ground === 'accent' ? P.ink : P.accent;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cx = c * cell + cell / 2, cy = r * cell + cell / 2;
      const d = Math.hypot(cx - ox, cy - oy) / maxD * b * 1.6;
      const s = track(lt, [[0, 0], [0 + d, 0.42], [b * 1.5 + d, 0.26], [b * 3 + d, 0.62], [b * 4.5 + d, 1.04]], 'ui');
      const rf = track(lt, [[0, 0], [b * 1.5 + d, 0.5], [b * 3 + d, 0.5], [b * 4.5 + d, 0]], 'ui');
      const rot = track(lt, [[0, 0], [b * 1.5 + d, Math.PI / 4], [b * 3 + d, Math.PI / 2]], 'ui');
      if (s <= 0.002) continue;
      const sz = cell * s;
      g.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      g.rrect(-sz / 2, -sz / 2, sz, sz, sz * rf, (r + c) % 5 === 0 ? P.ink : col);
      g.restore();
    }
    if (p.text) {
      const L = g.fit(p.text, { ...g.safe, h: g.safe.h * 0.5 }, { role: 'display', maxLines: 2 });
      const by = g.safe.y + (g.safe.h - L.h) / 2;
      const pad = g.u * 3, bp = ew(lt, b * 1.5, 0.5);
      g.rect(g.safe.x - pad, by - pad, (L.w + pad * 2) * bp, L.h + pad * 2 + L.size * 0.1, P.bg);
      drawText(g, L, g.safe.x, by, textOpts(P, lt, { start: b * 1.6, stagger: 0.06, exitAt: exitAt(S) }));
    }
  },
  cues(p, S) { const b = S.beat; return [0, 1.5, 3, 4.5].map((k) => ({ t: k * b, sfx: 'click', gain: 0.55 })); },
};

export const orbit = {
  beats: 8,
  describe: 'A central word with 4-8 tags orbiting it in 3D depth. Integrations, ecosystems, ingredients, topics.',
  props: { center: '1-2 words', items: 'array of 4-8 short tags (1-2 words)' },
  draw(g, p, lt, S) {
    const P = palette(g, S), ctx = g.ctx, items = arr(p.items).slice(0, 8), n = Math.max(1, items.length);
    const cx = g.W / 2, cy = g.safe.y + g.safe.h * 0.5;
    const R = g.portrait ? g.safe.w * 0.34 : Math.min(g.safe.w, g.safe.h) * 0.62, ry = R * (g.portrait ? 1.25 : 0.32);
    const tag = g.u * (g.portrait ? 6 : 4.2);
    const rot = lt * 0.45;
    const placed = items.map((it, k) => {
      const a = rot + (k / n) * TAU, z = Math.sin(a);
      const enter = sp(lt - 0.15 - k * S.beat * 0.25, g.style.motion.obj);
      const rr = lerp(R * 2.2, R, enter);
      return { it, x: cx + Math.cos(a) * rr, y: cy + z * ry * enter, z, enter };
    });
    const drawTag = (q) => {
      if (q.enter <= 0.01) return;
      const s = 0.75 + 0.25 * (q.z + 1) / 2;
      g.font(tag * s, 'text', { weight: 600 });
      const w = g.measure(q.it) + tag * 1.4 * s, h = tag * 2.1 * s;
      ctx.globalAlpha = (0.45 + 0.55 * (q.z + 1) / 2) * clamp(q.enter * 2);
      const back = q.z < 0;
      g.rrect(q.x - w / 2, q.y - h / 2, w, h, Math.min(h / 2, g.style.radius + h * 0.2), back ? alpha(P.ink, 0.12) : P.ink);
      g.text(q.it, q.x - w / 2 + tag * 0.7 * s, q.y + tag * 0.36 * s, back ? P.ink : P.bg, back ? { decor: true } : {});
      ctx.globalAlpha = 1;
    };
    // Orbit path
    ctx.beginPath(); ctx.ellipse(cx, cy, R, ry, 0, 0, TAU);
    ctx.strokeStyle = alpha(P.ink, 0.15 * ew(lt, 0, 0.8)); ctx.lineWidth = g.u * 0.25; ctx.stroke();
    placed.filter((q) => q.z < 0).forEach(drawTag);
    const L = g.fit(p.center || '', { x: 0, y: 0, w: R * 1.3, h: R * 0.5 }, { role: 'display', maxLines: 2, align: 'center' });
    const k = 1 + bump(lt, 0.1, 0.05);
    g.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    drawText(g, L, -L.w / 2 - (L.lines[0]?.x || 0) * 0, -L.h / 2, textOpts(P, lt, { start: 0, stagger: 0.06, ink: P.ground === 'accent' ? P.ink : P.accent, exitAt: exitAt(S) }));
    g.restore();
    placed.filter((q) => q.z >= 0).forEach(drawTag);
  },
  cues(p, S) { return arr(p.items).map((_, k) => ({ t: 0.15 + k * S.beat * 0.25, sfx: 'tick', gain: 0.4 })); },
};

// Fibonacci sphere, built once per point count (deterministic, no per-frame state).
const SPHERES = new Map();
function sphere(n) {
  if (SPHERES.has(n)) return SPHERES.get(n);
  const pts = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
    // Fake continents: keep points where layered noise is high.
    const lon = Math.atan2(Math.sin(th) * r, Math.cos(th) * r), lat = Math.asin(y);
    const land = noise1(lon * 2.1 + 3, 5) + noise1(lat * 3.3 + lon * 0.7, 9) * 0.8;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r, land > 0.15]);
  }
  SPHERES.set(n, pts);
  return pts;
}

export const globe = {
  beats: 8,
  describe: 'A rotating dot-matrix globe with pulsing hubs and arcs, plus a stat line. Reach, global, network, users worldwide.',
  props: { value: 'big stat, e.g. "120+ countries"', label: 'optional caption' },
  draw(g, p, lt, S) {
    const P = palette(g, S), ctx = g.ctx;
    const [top, bot] = splitV(g.safe, g.portrait ? 0.66 : 1, g.u * 2);
    const landscape = !g.portrait;
    const R = (landscape ? Math.min(g.safe.h, g.W * 0.45) * 0.5 : Math.min(top.w, top.h) * 0.48) * (0.85 + 0.15 * sp(lt, 'soft'));
    const cx = landscape ? g.W * 0.68 : g.W / 2, cy = landscape ? g.H / 2 : top.y + top.h / 2;
    const rot = lt * 0.35 + 0.6, tilt = 0.35;
    const col = P.ground === 'accent' ? P.ink : P.accent;
    const pts = sphere(1400);
    const proj = ([x, y, z]) => {
      const x1 = x * Math.cos(rot) + z * Math.sin(rot), z1 = -x * Math.sin(rot) + z * Math.cos(rot);
      const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
      return [cx + x1 * R, cy - y2 * R, z2];
    };
    const reveal = ew(lt, 0, 1.2, ease.outCubic);
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      if (hash(i, 3) > reveal) continue;
      const [x, y, z] = proj(pt);
      if (z < -0.05) continue;
      const s = g.u * (pt[3] ? 0.55 : 0.28) * (0.5 + 0.5 * z);
      ctx.globalAlpha = (pt[3] ? 0.95 : 0.35) * (0.3 + 0.7 * z);
      ctx.fillStyle = P.ink; ctx.fillRect(x - s, y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    // Hubs and arcs
    const r = rng(11), hubs = [];
    for (let k = 0; k < 7; k++) { let q; do { q = pts[Math.floor(r() * pts.length)]; } while (!q[3]); hubs.push(q); }
    hubs.forEach((h, k) => {
      const [x, y, z] = proj(h);
      if (z < 0.05) return;
      const t0 = S.beat * (0.5 + k * 0.5);
      if (lt < t0) return;
      const ph = ((lt - t0) / (S.beat * 2)) % 1;
      ctx.beginPath(); ctx.arc(x, y, g.u * (1 + ph * 5), 0, TAU);
      ctx.strokeStyle = alpha(col, (1 - ph) * z); ctx.lineWidth = g.u * 0.35; ctx.stroke();
      g.circle(x, y, g.u * 1.1 * z, col);
      if (k) {
        const [x0, y0, z0] = proj(hubs[k - 1]);
        if (z0 > 0.05) {
          const ap = ew(lt, t0, 0.8, ease.outCubic);
          const mx = (x0 + x) / 2, my = (y0 + y) / 2 - Math.hypot(x - x0, y - y0) * 0.45;
          ctx.beginPath(); ctx.moveTo(x0, y0);
          const N = 24;
          for (let j = 1; j <= Math.ceil(N * ap); j++) {
            const u = Math.min(j / N, ap), a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
            ctx.lineTo(a * x0 + b * mx + c * x, a * y0 + b * my + c * y);
          }
          ctx.strokeStyle = col; ctx.lineWidth = g.u * 0.4; ctx.stroke();
        }
      }
    });
    const textBox = landscape ? { x: g.safe.x, y: g.safe.y, w: g.W * 0.4, h: g.safe.h } : bot;
    if (p.value) {
      const L = g.fit(p.value, { ...textBox, h: textBox.h * (p.label ? 0.6 : 0.9) }, { role: 'display', maxLines: landscape ? 3 : 2, caps: false });
      const oy = landscape ? textBox.y + (textBox.h - L.h) / 2 - g.u * 4 : textBox.y;
      drawText(g, L, textBox.x, oy, textOpts(P, lt, { start: S.beat, stagger: 0.07, exitAt: exitAt(S) }));
      if (p.label) {
        const Ll = g.fit(p.label, { x: 0, y: 0, w: textBox.w, h: g.u * 10 }, { role: 'text', maxLines: 2, maxSize: g.u * 5 });
        drawText(g, Ll, textBox.x, oy + L.h + g.u * 5, textOpts(P, lt, { start: S.beat * 1.5, stagger: 0.03, exitAt: exitAt(S) }));
      }
    }
  },
  cues(p, S) { return Array.from({ length: 6 }, (_, k) => ({ t: S.beat * (1 + k * 0.5), sfx: 'tick', gain: 0.35 })); },
};

export const chapter = {
  beats: 4,
  describe: 'Section divider: a huge outlined numeral rolls in, then the chapter title. Use for long films with parts.',
  props: { index: 'e.g. "02"', title: '1-5 words' },
  draw(g, p, lt, S) {
    const P = palette(g, S), box = g.safe, ctx = g.ctx;
    const idx = String(p.index ?? '01');
    const [top, bot] = splitV(box, g.portrait ? 0.55 : 0.6, g.u * 3);
    const Ln = g.fit(idx, top, { role: 'display', maxLines: 1, caps: false });
    const pr = sp(lt, 'heavy'), ex = sp(lt - (exitAt(S) ?? 1e9), 'snap');
    g.save(); g.clipRect(0, top.y, g.W, top.h + g.u * 2);
    g.font(Ln.size, 'display', { caps: false });
    g.text(idx, box.x, top.y + top.h - (1 - pr) * -top.h * 0 + (1 - pr) * top.h - ex * top.h, P.ground === 'accent' ? P.ink : P.accent, { stroke: Math.max(3, Ln.size * 0.02) });
    g.restore();
    const L = g.fit(p.title || '', bot, { role: 'display', maxLines: 3 });
    drawText(g, L, bot.x, bot.y + g.u * 2, textOpts(P, lt, { start: S.beat * 0.5, stagger: 0.07, exitAt: exitAt(S) }));
  },
  cues: (p, S) => [{ t: 0, sfx: 'thump', gain: 0.7 }],
};
