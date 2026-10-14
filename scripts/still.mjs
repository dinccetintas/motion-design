// node scripts/still.mjs films/x.json 12.5 [out.png] [--format 16:9] [--style noir]
import { readFileSync } from 'node:fs';
import { still, closeBrowser } from '../server/renderer.js';
const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null; };
const spec = JSON.parse(readFileSync(a[0], 'utf8'));
if (opt('format')) spec.format = opt('format'); if (opt('style')) spec.style = opt('style');
const out = a[2] && !a[2].startsWith('--') ? a[2] : 'out/still.png';
await still(spec, +a[1], out); console.log(out); await closeBrowser();
