// node tools/sheet.mjs <page> <w> <h> <from> <to> <step> <out.png> [cols]
// Renders stills at from, from+step, ... < to and tiles them into a contact sheet for review.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [page, w, h, from, to, step, out, cols = '6'] = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), 'sheet-'));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const p = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('file://' + process.cwd() + '/' + page);
await p.evaluate(() => window.ready);
let n = 0;
for (let t = +from; t < +to - 1e-9; t += +step, n++) {
  await p.evaluate((x) => window.seek(x), t);
  await p.locator('#c').screenshot({ path: join(dir, String(n).padStart(3, '0') + '.png') });
}
await browser.close();
const tw = +w > +h ? 384 : 216, rows = Math.ceil(n / +cols);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '1', '-i', join(dir, '%03d.png'),
  '-vf', `scale=${tw}:-1,drawtext=text='%{eif\\:n*${step}+${from}\\:d\\:2}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,pad=iw+4:ih+4:2:2:gray,tile=${cols}x${rows}`,
  '-frames:v', '1', out]);
rmSync(dir, { recursive: true });
console.log(errors.length ? 'errors: ' + errors.join('\n') : `ok: ${n} stills`);
