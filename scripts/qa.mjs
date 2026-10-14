// node scripts/qa.mjs films/x.json [--format 16:9] [--sheet out/x.png] [--json]
// Scores a film on the studio's six axes and lists issues with fixes.
import { readFileSync } from 'node:fs';
import { analyze } from '../server/qa.js';
import { closeBrowser } from '../server/renderer.js';
const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null; };
const spec = JSON.parse(readFileSync(a[0], 'utf8'));
if (opt('format')) spec.format = opt('format');
if (opt('style')) spec.style = opt('style');
const t0 = Date.now();
const r = await analyze(spec, { sheet: opt('sheet') });
await closeBrowser();
if (a.includes('--json')) { console.log(JSON.stringify(r, null, 1)); process.exit(0); }
console.log(`scores ${JSON.stringify(r.scores)}  overall ${r.overall}  pass=${r.pass}  (${Date.now() - t0}ms)`);
console.log('metrics', JSON.stringify(r.metrics));
for (const i of r.issues.slice(0, 40)) console.log(`  [${i.severity}] ${i.axis} s${i.scene ?? '-'}: ${i.msg}  -> ${i.fix}`);
