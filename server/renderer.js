// Headless rendering: contact sheets, frames, audio and the final MP4.
// Because each frame is a pure function of time, frame ranges render in parallel
// workers and the encoded segments are concatenated losslessly.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { serveStatic } from './static.js';
import { renderScoreFile } from './audio.js';

let base = null, browserP = null;

/** Start (once) a static server for the render page; returns its origin. */
export async function origin() {
  if (base) return base;
  const srv = createServer((req, res) => { if (!serveStatic(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  srv.unref();
  base = `http://127.0.0.1:${srv.address().port}`;
  return base;
}

/** Shared Chromium, relaunched if it ever disconnects (crash, OOM, killed). */
export async function browser() {
  if (browserP) {
    const b = await browserP.catch(() => null);
    if (b && b.isConnected()) return b;
    browserP = null;
  }
  browserP = chromium.launch({ args: ['--disable-gpu-vsync', '--font-render-hinting=none'] });
  const b = await browserP;
  b.on('disconnected', () => { browserP = null; });
  return b;
}
export async function closeBrowser() { if (browserP) { const b = await browserP; browserP = null; await b.close(); } }

/** Absolute-ize asset paths so the render page can fetch them. */
function withAssetUrls(spec, o) {
  const s = JSON.parse(JSON.stringify(spec));
  for (const [k, v] of Object.entries(s.assets || {})) if (typeof v === 'string' && v.startsWith('/')) s.assets[k] = o + v;
  return s;
}

/** Open a page with the film loaded. Caller must close the page. */
export async function openFilm(spec, { originUrl } = {}) {
  const o = originUrl || await origin();
  const b = await browser();
  const page = await b.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[render page]', e.message));
  await page.goto(o + '/render.html');
  await page.waitForFunction(() => window.__ready === true);
  const info = await page.evaluate((s) => window.loadFilm(s), withAssetUrls(spec, o));
  return { page, info };
}

const dataUrlToBuf = (d) => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');

/** One frame per beat (or custom times), tiled. Writes PNG, returns { path, times, info }. */
export async function contactSheet(spec, out, { times, cols, scale } = {}) {
  const { page, info } = await openFilm(spec);
  try {
    const T = times === 'scenes' ? sceneTimes(info) : times || beatTimes(info);
    const c = cols || (info.W > info.H ? 4 : 8);
    const sc = scale || (info.W > info.H ? 0.2 : 0.18);
    const url = await page.evaluate(([t, c2, s]) => window.sheet(t, c2, s), [T, c, sc]);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, dataUrlToBuf(url));
    return { path: out, times: T, info };
  } finally { await page.close(); }
}

/** Frame at the middle of every beat plus the first frame (hook check). */
export function beatTimes(info) {
  const out = [0.0];
  for (let t = info.beat * 0.5; t < info.duration; t += info.beat) out.push(+t.toFixed(3));
  return out;
}

/** Three frames per scene: early, middle, late. */
export function sceneTimes(info) {
  return info.timeline.flatMap((s) => [0.2, 0.55, 0.92].map((f) => +(s.start + s.dur * f).toFixed(3)));
}

/** Single full-size frame as PNG. */
export async function still(spec, t, out) {
  const { page } = await openFilm(spec);
  try {
    const url = await page.evaluate((x) => window.frame(x, 60, 1), t);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, dataUrlToBuf(url));
    return out;
  } finally { await page.close(); }
}

function ffmpeg(args, { stdin = false } = {}) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [stdin ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  const done = new Promise((res, rej) => p.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg failed: ' + err.slice(-800))))));
  return { p, done };
}

/** Compose the score (pure JS, in Node) and write a WAV. */
export async function renderAudio(spec, out) {
  await renderScoreFile(spec, out);
  return out;
}

/** Measure integrated loudness (LUFS) and true peak with ffmpeg's ebur128 filter. */
export async function loudness(file) {
  return new Promise((res) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-']);
    let s = '';
    p.stderr.on('data', (d) => { s += d; });
    p.on('close', () => {
      const I = /I:\s+(-?[\d.]+) LUFS/.exec(s.slice(s.lastIndexOf('Summary')));
      const TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(s.slice(s.lastIndexOf('Summary')));
      res({ lufs: I ? +I[1] : null, truePeak: TP ? +TP[1] : null });
    });
  });
}

/** Two-pass loudnorm to -14 LUFS / -1 dBTP at 48 kHz. */
export async function normalizeAudio(inp, out) {
  const m = await new Promise((res) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-i', inp, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
    let s = ''; p.stderr.on('data', (d) => { s += d; });
    p.on('close', () => { try { res(JSON.parse(s.slice(s.lastIndexOf('{'), s.lastIndexOf('}') + 1))); } catch { res(null); } });
  });
  const af = m ? `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` : 'loudnorm=I=-14:TP=-1.5:LRA=11';
  await ffmpeg(['-i', inp, '-af', af, '-ar', '48000', out]).done;
  return out;
}

/**
 * Render the full film to MP4 (H.264 yuv420p, CRF 16) with motion blur and the score.
 * opts: fps, sub (subframes per frame), shutter, workers, onProgress(fraction, label)
 */
export async function renderVideo(spec, out, opts = {}) {
  const fps = opts.fps || 60, sub = opts.sub ?? 4, shutter = opts.shutter ?? 0.5;
  const workers = Math.max(1, opts.workers || 3);
  const tmp = join(dirname(out), '.parts-' + Date.now());
  mkdirSync(tmp, { recursive: true });
  const prog = opts.onProgress || (() => {});
  const probe = await openFilm(spec); const info = probe.info; await probe.page.close();
  const total = Math.round(info.duration * fps);
  const per = Math.ceil(total / workers);
  const done = new Array(workers).fill(0);
  const report = () => prog(done.reduce((a, b) => a + b, 0) / total * 0.9, 'frames');
  const segs = [];
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = w * per, b = Math.min(total, a + per);
    if (a >= b) return;
    const seg = join(tmp, `seg${w}.mp4`); segs[w] = seg;
    const { page } = await openFilm(spec);
    const enc = ffmpeg(['-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', opts.preset || 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), seg], { stdin: true });
    try {
      for (let i = a; i < b; i++) {
        const url = await page.evaluate(([t, f, s, sh]) => window.frame(t, f, s, sh), [i / fps, fps, sub, shutter]);
        if (!enc.p.stdin.write(dataUrlToBuf(url))) await new Promise((r) => enc.p.stdin.once('drain', r));
        done[w] = i - a + 1;
        if (i % 15 === 0) report();
      }
    } finally { enc.p.stdin.end(); await page.close(); }
    await enc.done;
  }));
  const list = join(tmp, 'list.txt');
  writeFileSync(list, segs.filter(Boolean).map((s) => `file '${resolve(s)}'`).join('\n'));
  const silent = join(tmp, 'silent.mp4');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]).done;
  prog(0.92, 'score');
  let audio = null, lufs = null;
  if (opts.audio !== false) {
    const raw = await renderAudio(spec, join(tmp, 'score.wav'));
    if (raw) { audio = await normalizeAudio(raw, join(tmp, 'score14.wav')); lufs = await loudness(audio); }
  }
  prog(0.97, 'mux');
  mkdirSync(dirname(out), { recursive: true });
  if (audio) await ffmpeg(['-i', silent, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]).done;
  else await ffmpeg(['-i', silent, '-c', 'copy', '-movflags', '+faststart', out]).done;
  if (opts.keepAudio && audio) await ffmpeg(['-i', audio, '-c', 'copy', out.replace(/\.mp4$/, '.wav')]).done;
  if (!opts.keepTmp) rmSync(tmp, { recursive: true, force: true });
  prog(1, 'done');
  return { path: out, info, frames: total, loudness: lufs };
}

export { existsSync };
