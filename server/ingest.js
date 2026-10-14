// Ingestion: turn a URL, an article, or a topic into a "dossier" the agents work from.
// For URLs we render the real page: screenshots, text structure, brand colors, fonts, logo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { browser } from './renderer.js';

const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

/** Classify the user's input. */
export function classify(input) {
  const s = String(input || '').trim();
  const url = s.match(/https?:\/\/[^\s)]+/i)?.[0] || (URL_RE.test(s.split(/\s+/)[0]) && s.split(/\s+/).length <= 3 ? s.split(/\s+/)[0] : null);
  if (url) return { kind: 'url', url: /^https?:/.test(url) ? url : 'https://' + url, note: s.replace(url, '').trim() };
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words > 80) return { kind: 'article', text: s };
  return { kind: 'topic', topic: stripDirections(s), note: s };
}

/** Remove production directions (format, length, mood) from a topic: "X, cinematic, 16:9" -> "X". */
export function stripDirections(s) {
  const dir = /^(\d{1,2}:\d{1,2}|vertical|horizontal|square|landscape|portrait|widescreen|cinematic|epic|energetic|calm|chill|upbeat|playful|minimal|dark|light|bright|elegant|luxury|fun|hype|short|long|\d+\s*(s|sec|secs|seconds)|for (tiktok|reels|instagram|youtube|shorts)|make it .*)$/i;
  const parts = s.split(/\s*[,;]\s*|\s+-\s+/).filter(Boolean);
  const keep = parts.filter((p, i) => i === 0 || !dir.test(p.trim()));
  return keep.join(', ').trim() || s;
}

/** Sentences from prose, cleaned. */
export function sentences(text) {
  return String(text).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map((x) => x.trim()).filter((x) => x.length > 20 && x.length < 260);
}

/** Numbers with their surrounding phrase: "87% of deploys", "$4.2M raised". */
export function findNumbers(text) {
  const out = [], seen = new Set();
  const re = /([$€£]?\s?\d[\d,.]*\s?(%|x|×|k|K|M|B|bn|million|billion|\+)?)/g;
  for (const sent of sentences(text)) {
    let m, found = 0;
    while ((m = re.exec(sent)) && found < 1) {
      const raw = m[1].trim().replace(/[,.]$/, '');
      if (/\b(Fortune|Forbes|Top|Inc\.?)\s*$/i.test(sent.slice(0, m.index))) continue; // list names, not stats
      if (/^\d{4}$/.test(raw) && +raw > 1900 && +raw < 2100) continue; // years are dates, not stats
      if (!/[%x×kKMB+$€£]|million|billion/.test(raw) && parseFloat(raw.replace(/[^\d.]/g, '')) < 10) continue;
      const key = raw + sent.slice(0, 40);
      if (seen.has(key)) continue; seen.add(key);
      out.push({ raw, sentence: sent }); found++;
    }
  }
  return out.slice(0, 20);
}

/** Render a URL and extract a dossier. Writes assets into dir. */
export async function ingestUrl(url, dir, { onStatus = () => {} } = {}) {
  mkdirSync(dir, { recursive: true });
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' });
  const page = await ctx.newPage();
  try {
    onStatus('Opening ' + url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // Dismiss obvious cookie banners so screenshots show the product.
    for (const sel of ['button:has-text("Accept all")', 'button:has-text("Accept")', 'button:has-text("I agree")', 'button:has-text("Got it")', '[aria-label="Close"]']) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) { await el.click({ timeout: 1500 }).catch(() => {}); break; }
    }
    // Trigger lazy content, then return to the top.
    await page.evaluate(async () => { for (let y = 0; y < 4000; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(600);
    onStatus('Reading the page');
    const data = await page.evaluate(() => {
      const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
      const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || '';
      const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.1; };
      // Animated headlines often duplicate their text ("X X"); keep one copy.
      const undup = (s) => { const h = s.length / 2; return s.length % 2 === 1 && s.slice(0, Math.floor(h)) === s.slice(Math.ceil(h)) ? s.slice(0, Math.floor(h)) : s; };
      const heads = (sel) => [...new Set([...document.querySelectorAll(sel)].filter(vis).map(txt).map(undup))].filter((s) => s && s.length < 140);
      const paras = [...document.querySelectorAll('p, li, blockquote')].filter(vis).map(txt).filter((s) => s.length > 30 && s.length < 600);
      const ctas = [...document.querySelectorAll('a, button')].filter(vis).filter((el) => {
        const cs = getComputedStyle(el); const bg = cs.backgroundColor;
        return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && txt(el).length > 1 && txt(el).length < 30;
      }).map(txt);
      // Brand colors: weight each painted color by its area and saturation.
      const colors = {};
      const addC = (c, w) => { if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return; const m = c.match(/[\d.]+/g); if (!m) return; if (m[3] !== undefined && +m[3] < 0.5) return; const hex = '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join(''); colors[hex] = (colors[hex] || 0) + w; };
      for (const el of document.querySelectorAll('body, header, nav, section, div, a, button, h1, h2, h3, span, footer')) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect(); if (r.top > 2400) continue;
        const cs = getComputedStyle(el), area = Math.min(r.width * r.height, 1440 * 900);
        addC(cs.backgroundColor, area / 1000);
        if (/^(A|BUTTON|H1|H2|H3|SPAN)$/.test(el.tagName) && el.childElementCount === 0) addC(cs.color, (r.width * r.height) / 300);
      }
      const h1 = document.querySelector('h1');
      const fontOf = (el) => el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() : '';
      // Logo candidates
      const logos = [...document.querySelectorAll('header img, nav img, a[href="/"] img, img[alt*="logo" i], img[src*="logo" i], img[class*="logo" i]')]
        .filter(vis).map((im) => ({ src: im.currentSrc || im.src, w: im.naturalWidth, h: im.naturalHeight, top: im.getBoundingClientRect().top })).filter((l) => l.top < 200 && l.src);
      const icon = document.querySelector('link[rel="apple-touch-icon"]')?.href || document.querySelector('link[rel~="icon"][sizes]')?.href || '';
      return {
        title: document.title, description: meta('description') || meta('og:description'), siteName: meta('og:site_name'),
        ogImage: meta('og:image'), themeColor: meta('theme-color'), lang: document.documentElement.lang || '',
        h1: heads('h1').slice(0, 3), h2: heads('h2').slice(0, 14), h3: heads('h3').slice(0, 16), paragraphs: paras.slice(0, 40), ctas: [...new Set(ctas)].slice(0, 8),
        colors: Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 14), fonts: { heading: fontOf(h1 || document.querySelector('h2')), body: fontOf(document.querySelector('p') || document.body) },
        bodyBg: getComputedStyle(document.body).backgroundColor, logos: logos.slice(0, 3), icon,
        fullHeight: Math.min(document.documentElement.scrollHeight, 6000),
      };
    });
    onStatus('Capturing screenshots');
    const assets = {};
    await page.screenshot({ path: join(dir, 'hero.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } });
    assets.hero = 'hero.png';
    const fh = Math.max(900, Math.min(data.fullHeight, 5200));
    await page.setViewportSize({ width: 1440, height: fh }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(dir, 'page.png'), clip: { x: 0, y: 0, width: 1440, height: fh } }).catch(() => {});
    assets.page = 'page.png';
    // Logo: fetch the best candidate so the end card can use it.
    const logoSrc = data.logos.sort((a, b) => b.w * b.h - a.w * a.h)[0]?.src || data.icon;
    if (logoSrc) {
      try {
        const res = await page.request.get(logoSrc, { timeout: 8000 });
        const ct = res.headers()['content-type'] || '';
        if (res.ok() && /image\/(png|jpeg|webp|svg)/.test(ct)) {
          const ext = ct.includes('svg') ? 'svg' : ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
          writeFileSync(join(dir, 'logo.' + ext), await res.body());
          assets.logo = 'logo.' + ext;
        }
      } catch { /* logo is optional */ }
    }
    const text = [data.description, ...data.h1, ...data.h2, ...data.h3, ...data.paragraphs].join('. ');
    const host = new URL(page.url()).hostname.replace(/^www\./, '');
    const name = (data.siteName || data.title.split(/\s[|\-–—:]\s/)[0] || host.split('.')[0]).trim();
    return {
      kind: 'url', url: page.url(), host, name, title: data.title, description: data.description, lang: data.lang,
      headings: { h1: data.h1, h2: data.h2, h3: data.h3 }, paragraphs: data.paragraphs, ctas: data.ctas,
      numbers: findNumbers(text), brand: { name, colors: brandPalette(data.colors, data.themeColor, data.bodyBg), fonts: data.fonts },
      assets,
    };
  } finally { await ctx.close(); }
}

// ---- Brand palette ---------------------------------------------------------------
const toRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const lumOf = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const cssToHex = (c) => { const m = String(c).match(/[\d.]+/g); return m ? '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('') : null; };

/** Pick accent (most present saturated color), plus darkest and lightest grounds. */
export function brandPalette(weighted, themeColor, bodyBg) {
  const list = weighted.map(([hex, w]) => ({ hex, w, rgb: toRgb(hex) }));
  const accents = list.filter((c) => sat(c.rgb) > 0.35 && lumOf(c.rgb) > 0.12 && lumOf(c.rgb) < 0.92).sort((a, b) => b.w * (0.5 + sat(b.rgb)) - a.w * (0.5 + sat(a.rgb)));
  let accent = accents[0]?.hex || null;
  if (!accent && /^#[0-9a-f]{6}$/i.test(themeColor || '') && sat(toRgb(themeColor)) > 0.3) accent = themeColor;
  const darks = list.filter((c) => lumOf(c.rgb) < 0.2).sort((a, b) => b.w - a.w);
  const lights = list.filter((c) => lumOf(c.rgb) > 0.85).sort((a, b) => b.w - a.w);
  const bg = cssToHex(bodyBg);
  return { accent, dark: darks[0]?.hex || null, light: lights[0]?.hex || (bg && lumOf(toRgb(bg)) > 0.85 ? bg : null), all: list.slice(0, 8).map((c) => c.hex) };
}

/** Article/topic dossiers need no browser. */
export function ingestText(c) {
  if (c.kind === 'article') {
    const s = sentences(c.text);
    return { kind: 'article', title: s[0]?.slice(0, 90) || 'Article', paragraphs: s.slice(0, 60), numbers: findNumbers(c.text), text: c.text.slice(0, 20000), brand: {}, assets: {} };
  }
  return { kind: 'topic', topic: c.topic, title: c.topic, paragraphs: [], numbers: [], brand: {}, assets: {} };
}
