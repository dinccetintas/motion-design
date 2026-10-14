// node scripts/sheet.mjs films/x.json [out.png] [--format 16:9] [--style noir] [--times 0,1,2]
// Contact sheet: one frame per beat. The first look at any film.
import { readFileSync } from 'node:fs';
import { contactSheet, closeBrowser } from '../server/renderer.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const spec = JSON.parse(readFileSync(args[0], 'utf8'));
if (opt('format')) spec.format = opt('format');
if (opt('style')) spec.style = opt('style');
const out = args[1] && !args[1].startsWith('--') ? args[1] : 'out/sheet.png';
const times = opt('times') === 'scenes' ? 'scenes' : opt('times') ? opt('times').split(',').map(Number) : undefined;
const t0 = Date.now();
const r = await contactSheet(spec, out, { times, scale: opt('scale') ? +opt('scale') : undefined, cols: opt('cols') ? +opt('cols') : undefined });
console.log(`${out}  ${r.times.length} frames  ${r.info.duration.toFixed(2)}s film  ${Date.now() - t0}ms`);
console.log(r.info.timeline.map((s) => `${s.start.toFixed(2)} ${s.type}`).join(' | '));
await closeBrowser();
