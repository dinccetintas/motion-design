// Media scenes: real screenshots, images, code, and the closing lockup.
import { sp, ew, ease, clamp, alpha, lerp, track, bump, TAU } from '../core.js';
import { drawText, typed } from '../kinetic.js';
import { palette, textOpts, splitV, exitAt, arr, num } from './util.js';

function cursor(g, x, y, s, color, outline) {
  const ctx = g.ctx;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.lineTo(9, 26); ctx.lineTo(15, 40); ctx.lineTo(21, 37); ctx.lineTo(15, 24); ctx.lineTo(26, 24); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}

export const screen = {
  beats: 8,
  describe: 'The real website/product screenshot in a browser window: it rises in, scrolls on the beat, a cursor clicks a focus point, camera pushes in. Needs props.image (asset key).',
  props: { image: 'asset key of a screenshot', title: 'optional headline, <= 7 words', url: 'domain shown in the bar', focus: '[x, y] 0-1 point on the screenshot to click' },
  draw(g, p, lt, S) {
    const P = palette(g, S), ctx = g.ctx, b = S.beat, box = g.safe;
    const img = S.assets?.[p.image];
    let win, titleBox;
    if (g.portrait) {
      const [a, c] = splitV(box, p.title ? 0.24 : 0, g.u * 4);
      titleBox = a; win = { x: g.u * 4, y: c.y, w: g.W - g.u * 8, h: c.h + g.u * 2 };
    } else {
      titleBox = { x: box.x, y: box.y, w: box.w * 0.34, h: box.h };
      win = { x: box.x + box.w * 0.4, y: box.y - g.u * 2, w: box.w * 0.6 + g.u * 2, h: box.h + g.u * 4 };
      if (!p.title) win = { x: box.x + box.w * 0.08, y: box.y - g.u * 2, w: box.w * 0.84, h: box.h + g.u * 4 };
    }
    if (p.title) {
      const L = g.fit(p.title, titleBox, { role: 'display', maxLines: g.portrait ? 3 : 5, maxSize: g.u * (g.portrait ? 11 : 10) });
      const oy = g.portrait ? titleBox.y + titleBox.h - L.h : titleBox.y + (titleBox.h - L.h) / 2;
      drawText(g, L, titleBox.x, oy, textOpts(P, lt, { start: 0, stagger: 0.06, exitAt: exitAt(S) }));
    }
    const enter = sp(lt - 0.1, 'ui'), ex = sp(lt - (exitAt(S) ?? 1e9), 'snap');
    const bar = g.u * 7, r = Math.max(g.u * 2, g.style.radius * 0.6);
    const content = { x: win.x, y: win.y + bar, w: win.w, h: win.h - bar };
    // Scroll in two steps that land on beats.
    const ih = img ? img.height * (content.w / img.width) : content.h * 2.2;
    const maxScroll = Math.max(0, ih - content.h);
    const scroll = Math.min(maxScroll, track(lt, [[0, 0], [b * 2, maxScroll * 0.35], [b * 4.5, maxScroll * 0.55]], 'soft'));
    const focus = arr(p.focus).length === 2 ? p.focus.map(Number) : [0.5, 0.3];
    const fx = content.x + focus[0] * content.w, fy = content.y + focus[1] * ih - Math.min(scroll, maxScroll * 0.55);
    const zoom = 1 + 0.22 * sp(lt - b * 5.5, 'soft');
    g.save();
    ctx.translate(0, (1 - enter) * g.H * 0.7 + ex * g.H);
    ctx.translate(fx, clamp(fy, content.y, content.y + content.h)); ctx.scale(zoom, zoom); ctx.rotate((1 - enter) * -0.06);
    ctx.translate(-fx, -clamp(fy, content.y, content.y + content.h));
    // Depth: an offset soft shadow, never a halo.
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = g.u * 6; ctx.shadowOffsetY = g.u * 2.5;
    g.rrect(win.x, win.y, win.w, win.h, r, S.ground === 'dark' ? '#1c1d20' : '#ffffff'); ctx.restore();
    // Bar with URL pill
    const barCol = S.ground === 'dark' ? '#26272b' : '#f1f1f1';
    ctx.save(); ctx.beginPath(); ctx.roundRect(win.x, win.y, win.w, win.h, r); ctx.clip();
    g.rect(win.x, win.y, win.w, bar, barCol);
    const pillW = Math.min(win.w * 0.62, g.u * 60), pillX = win.x + (win.w - pillW) / 2;
    g.rrect(pillX, win.y + bar * 0.2, pillW, bar * 0.6, bar * 0.3, S.ground === 'dark' ? '#18191c' : '#ffffff');
    g.font(bar * 0.3, 'mono');
    const url = String(p.url || S.brand?.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    g.text(typed(url, lt, 0.3, 40), pillX + bar * 0.35, win.y + bar * 0.6, S.ground === 'dark' ? '#d8d8d8' : '#333333', { decor: true });
    // Content
    ctx.beginPath(); ctx.rect(content.x, content.y, content.w, content.h); ctx.clip();
    if (img) ctx.drawImage(img, content.x, content.y - scroll, content.w, ih);
    else { // Neutral skeleton if the screenshot is missing; never an invented UI.
      g.rect(content.x, content.y, content.w, content.h, S.ground === 'dark' ? '#202125' : '#fafafa');
      for (let k = 0; k < 8; k++) g.rrect(content.x + g.u * 4, content.y + g.u * (6 + k * 9) - scroll * 0.2, content.w * (0.4 + 0.5 * ((k * 37) % 10) / 10), g.u * 4, g.u, alpha(S.ground === 'dark' ? '#ffffff' : '#000000', 0.08));
    }
    ctx.restore();
    // Cursor glides in, clicks on the beat.
    const tc = b * 5.5;
    const cp = ease.inOutCubic(clamp((lt - b * 4.2) / (tc - b * 4.2)));
    if (lt > b * 4.2) {
      const cx = lerp(win.x + win.w * 0.95, fx, cp), cy = lerp(win.y + win.h * 0.98, fy, cp);
      const click = bump(lt, tc, 1);
      if (lt > tc) {
        const rp = clamp((lt - tc) / 0.6);
        ctx.beginPath(); ctx.arc(fx, fy, g.u * (1 + rp * 7), 0, TAU);
        ctx.strokeStyle = alpha(g.style.grounds.accent.bg, 1 - rp); ctx.lineWidth = g.u * 0.6; ctx.stroke();
      }
      cursor(g, cx, cy, (g.u / 7) * (1 - 0.18 * click), '#111111', '#ffffff');
    }
    g.restore();
  },
  cues(p, S) { const b = S.beat; return [{ t: 0.1, sfx: 'whoosh', gain: 0.45, dur: 0.5 }, { t: b * 2, sfx: 'swish', gain: 0.35 }, { t: b * 4.5, sfx: 'swish', gain: 0.35 }, { t: b * 5.5, sfx: 'click', gain: 0.8 }]; },
};

export const image = {
  beats: 6,
  describe: 'A full-bleed image revealed through an expanding window, slow push, caption plate. Needs props.image (asset key).',
  props: { image: 'asset key', caption: 'optional, <= 10 words, *accent* ok' },
  draw(g, p, lt, S) {
    const P = palette(g, S), ctx = g.ctx, img = S.assets?.[p.image];
    const rv = ease.inOutExpo(clamp(lt / 0.9));
    const w = lerp(g.W * 0.3, g.W, rv), h = lerp(g.H * 0.04, g.H, rv);
    g.save(); ctx.beginPath(); ctx.rect((g.W - w) / 2, (g.H - h) / 2, w, h); ctx.clip();
    if (img) g.cover(img, 0, 0, g.W, g.H, 0.5, 0.5, 1.12 - 0.08 * clamp(lt / S.dur));
    else g.bg(P.surface);
    g.restore();
    if (p.caption) {
      const box = g.safe;
      const L = g.fit(p.caption, { x: 0, y: 0, w: box.w * 0.9, h: box.h * 0.3 }, { role: 'display', maxLines: 3, maxSize: g.u * 10 });
      const pad = g.u * 3.5, bx = box.x - pad, by = box.b - L.h - pad * 2;
      const pp = ew(lt, S.beat * 1.5, 0.6);
      g.rect(bx, by, (L.w + pad * 2) * pp, L.h + pad * 2 + L.size * 0.12, P.bg);
      drawText(g, L, box.x, by + pad, textOpts(P, lt, { start: S.beat * 1.6, stagger: 0.05, exitAt: exitAt(S) }));
    }
  },
  cues: (p, S) => [{ t: 0, sfx: 'whoosh', gain: 0.45, dur: 0.9 }],
};

const KW = /\b(const|let|var|function|return|import|from|await|async|export|default|if|else|for|while|class|new|def|fn|pub|use|struct|impl|true|false|null|None|self|this)\b/;
export const code = {
  beats: 8,
  describe: 'A code editor panel types out 3-12 lines of real code with syntax color. For developer tools and APIs.',
  props: { title: 'optional, <= 6 words', code: 'string with \\n line breaks, 3-12 lines, <= 48 chars per line' },
  draw(g, p, lt, S) {
    const P = palette(g, S), ctx = g.ctx, box = g.safe;
    const lines = String(p.code || '').split('\n').slice(0, 12);
    const [a, c] = splitV(box, p.title ? (g.portrait ? 0.2 : 0.22) : 0, g.u * 4);
    if (p.title) {
      const L = g.fit(p.title, a, { role: 'display', maxLines: 2, maxSize: g.u * 11 });
      drawText(g, L, a.x, a.y + a.h - L.h, textOpts(P, lt, { start: 0, stagger: 0.05, exitAt: exitAt(S) }));
    }
    const panelH = Math.min(c.h, g.u * (12 + lines.length * (g.portrait ? 10 : 8)));
    const panel = { x: c.x - g.u * 2, y: c.y + (c.h - panelH) * 0.4, w: c.w + g.u * 4, h: panelH };
    const enter = sp(lt - 0.05, 'ui'), ex = sp(lt - (exitAt(S) ?? 1e9), 'snap');
    const dark = S.ground !== 'dark';
    const pbg = dark ? '#111214' : '#1a1b1f', pink = '#e8e8e8';
    g.save(); ctx.translate(0, (1 - enter) * g.u * 30 + ex * g.H); ctx.globalAlpha = clamp(enter * 2);
    g.rrect(panel.x, panel.y, panel.w, panel.h, Math.max(g.u * 2, g.style.radius * 0.6), pbg);
    const longest = Math.max(10, ...lines.map((l) => l.length));
    const size = Math.min(g.u * (g.portrait ? 5.6 : 4.4), (panel.w - g.u * 14) / (longest * 0.62));
    g.font(size, 'mono');
    const total = lines.join('\n').length, cps = total / Math.max(0.5, S.dur * 0.6);
    let shown = Math.floor(Math.max(0, lt - S.beat * 0.5) * cps);
    const lh = size * 1.55, x0 = panel.x + g.u * 10, y0 = panel.y + g.u * 6 + size;
    const accent = g.style.grounds.dark.accent;
    let caret = null;
    lines.forEach((ln, i) => {
      const y = y0 + i * lh;
      g.text(String(i + 1).padStart(2, ' '), panel.x + g.u * 3, y, alpha(pink, 0.3), { decor: true });
      const vis = ln.slice(0, Math.max(0, shown)); shown -= ln.length + 1;
      let x = x0;
      for (const tok of vis.split(/(\s+|[(){}[\],.;:=<>+\-*/'"`])/)) {
        if (!tok) continue;
        const col = /^\/\/|^#/.test(vis.trim()) ? alpha(pink, 0.4) : KW.test(tok) ? accent : /^['"`]/.test(tok) ? '#9fb7c8' : pink;
        g.text(tok, x, y, col); x += g.measure(tok);
      }
      if (vis.length < ln.length && caret == null) caret = [x, y];
      if (i === lines.length - 1 && caret == null) caret = [x, y];
    });
    if (caret && Math.floor(lt * 2.5) % 2 === 0) g.rect(caret[0] + 2, caret[1] - size * 0.8, size * 0.55, size * 0.95, accent);
    g.restore();
  },
  cues(p, S) { const out = []; for (let k = 0; k < 14; k++) out.push({ t: S.beat * 0.5 + k * (S.dur * 0.6) / 14, sfx: 'key', gain: 0.25 }); return out; },
};

export const endcard = {
  beats: 6,
  describe: 'Closing lockup: brand name builds letter by letter, accent mark lands, tagline, CTA pill and URL. Always last.',
  props: { name: 'brand or film name', tagline: '<= 8 words', cta: 'short call to action, <= 4 words', url: 'domain', logo: 'optional asset key' },
  draw(g, p, lt, S) {
    const P = palette(g, S), ctx = g.ctx, box = g.safe;
    const name = String(p.name || S.brand?.name || '');
    const logo = p.logo ? S.assets?.[p.logo] : null;
    const L = g.fit(name, { ...box, h: box.h * (g.portrait ? 0.32 : 0.4) }, { role: 'display', maxLines: 2 });
    const est = L.h + g.u * (p.tagline ? 20 : 0) + g.u * (p.cta ? 17 : 0) + g.u * (p.url ? 7 : 0);
    let y = box.y + Math.max(g.u * 18, (box.h - est) * 0.45);
    if (logo) {
      const lh = g.u * 16, lw = lh * (logo.width / logo.height), lp = sp(lt, g.style.motion.obj);
      ctx.save(); ctx.globalAlpha = clamp(lp * 2); ctx.translate(box.x, y - lh - g.u * 6 + (1 - lp) * g.u * 6);
      ctx.drawImage(logo, 0, 0, lw, lh); ctx.restore();
    }
    // Per-character build for the wordmark.
    const capH = L.capH;
    let land = 0;
    L.lines.forEach((ln, li) => {
      const baseY = y + ln.y;
      let cx = box.x + ln.x;
      g.font(L.size, 'display');
      const str = ln.words.map((w) => w.text).join(' ');
      g.save(); g.clipRect(box.x - g.u * 4, baseY - capH - L.size * 0.25, box.w + g.u * 8, capH + L.size * 0.5);
      [...g.cased(str)].forEach((ch, j) => {
        const t0 = 0.05 + (li * 6 + j) * 0.035;
        land = Math.max(land, t0 + 0.3);
        const pr = sp(lt - t0, 'snap');
        g.text(ch, cx, baseY + (1 - pr) * (capH + L.size * 0.3), P.ink);
        cx += g.measure(ch);
      });
      g.restore();
      if (li === L.lines.length - 1) {
        // The accent mark: a dot that drops onto the baseline and settles.
        const dp = sp(lt - land, 'bounce'), r = L.size * 0.09;
        const dx = cx + r * 1.3, dy = lerp(box.y - g.u * 10, baseY - r, dp);
        if (lt > land - 0.05) g.rrect(dx - r, dy - r, r * 2, r * 2, g.style.radius === 0 ? 0 : r, P.ground === 'accent' ? P.ink : P.hilite);
      }
    });
    y += L.h + g.u * 6;
    if (p.tagline) {
      const Lt = g.fit(p.tagline, { x: 0, y: 0, w: box.w, h: g.u * 18 }, { role: 'text', maxLines: 2, maxSize: g.u * (g.portrait ? 8 : 6) });
      drawText(g, Lt, box.x, y, textOpts(P, lt, { start: land + 0.15, stagger: 0.04, mode: 'rise' }));
      y += Lt.h + g.u * 9;
    }
    if (p.cta) {
      const cp = sp(lt - (land + 0.5), g.style.motion.obj);
      g.font(g.u * (g.portrait ? 6.4 : 5), 'text', { weight: 700 });
      const tw = g.measure(p.cta), ph = g.u * (g.portrait ? 14 : 11), pw = tw + g.u * 12;
      if (cp > 0.01) {
        ctx.save(); ctx.translate(box.x, y + (1 - cp) * g.u * 10); ctx.globalAlpha = clamp(cp * 2);
        g.rrect(0, 0, pw, ph, g.style.radius ? ph / 2 : 0, P.ground === 'accent' ? P.ink : P.hilite);
        g.text(p.cta, g.u * 6, ph * 0.64, P.ground === 'accent' ? P.bg : g.style.grounds.accent.ink);
        ctx.restore();
      }
      y += ph + g.u * 6;
    }
    if (p.url) {
      g.font(g.u * (g.portrait ? 5 : 4), 'mono');
      g.text(typed(String(p.url).replace(/^https?:\/\//, ''), lt, land + 0.8, 30), box.x, y + g.u * 3, alpha(P.ink, 0.8));
    }
  },
  cues(p, S) {
    const n = String(p.name || '').length, land = 0.05 + Math.min(n, 18) * 0.035 + 0.3;
    return [{ t: 0.05, sfx: 'whoosh', gain: 0.4, dur: 0.4 }, { t: land, sfx: 'thump', gain: 0.9 }, { t: land + 0.5, sfx: 'pop', gain: 0.5 }];
  },
};
