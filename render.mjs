// node render.mjs films/x.json [out/x.mp4] [--fps 60] [--sub 4] [--workers 3] [--format 16:9] [--style noir] [--mood chill]
// Renders a film to H.264 yuv420p CRF 16 with motion blur and its synthesized score at -14 LUFS.
import { readFileSync } from 'node:fs';
import { renderVideo, contactSheet, closeBrowser } from './server/renderer.js';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
if (!a[0]) { console.log('usage: node render.mjs films/x.json [out.mp4] [--fps 60] [--sub 4] [--workers 3]'); process.exit(1); }
const spec = JSON.parse(readFileSync(a[0], 'utf8'));
if (opt('format')) spec.format = opt('format');
if (opt('style')) spec.style = opt('style');
if (opt('mood')) spec.music = { ...(spec.music || {}), mood: opt('mood'), bpm: undefined };
const out = a[1] && !a[1].startsWith('--') ? a[1] : 'out/' + a[0].split('/').pop().replace('.json', '.mp4');
const t0 = Date.now();
let last = -1;
const r = await renderVideo(spec, out, {
  fps: +opt('fps', 60), sub: +opt('sub', 4), workers: +opt('workers', 3),
  onProgress: (p, label) => { const pc = Math.floor(p * 20) * 5; if (pc !== last) { last = pc; process.stdout.write(`\r${label} ${pc}%   `); } },
});
await contactSheet(spec, out.replace('.mp4', '.contact.png'));
await closeBrowser();
console.log(`\n${r.path}  ${r.frames} frames  ${r.info.duration.toFixed(2)}s  loudness ${JSON.stringify(r.loudness)}  in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
