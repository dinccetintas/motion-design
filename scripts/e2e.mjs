// node scripts/e2e.mjs "<brief>" out/prefix  -> drives the studio like a user: submit a brief, wait for
// the crew, screenshot each state, and report console errors and the measured scores.
// MOBILE=1 for a phone viewport; BASE=http://host:port to target another server.
import { chromium } from 'playwright';

const [brief, out = 'out/e2e'] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:4100';
const b = await chromium.launch();
const vp = process.env.MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const p = await b.newPage({ viewport: vp });
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await p.goto(base + '/studio', { waitUntil: 'networkidle' });
await p.screenshot({ path: `${out}-0-empty.png` });
await p.fill('#empty-msg', brief);
await p.click('#empty-form button[type=submit]');
await p.waitForFunction(() => location.hash.length > 1, null, { timeout: 15000 });
const id = await p.evaluate(() => location.hash.slice(1));
const t0 = Date.now();
await p.waitForTimeout(3000);
await p.screenshot({ path: `${out}-1-working.png` });
for (;;) {
  const s = await p.evaluate(async (pid) => (await fetch('/api/projects/' + pid)).json(), id);
  if (!s.busy && s.spec) break;
  if (Date.now() - t0 > 240000) { console.log('TIMEOUT'); break; }
  await p.waitForTimeout(1500);
}
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}-2-done.png` });
await p.click('#play'); await p.waitForTimeout(2200); await p.click('#play');
await p.screenshot({ path: `${out}-3-played.png` });
await p.click('#t-review'); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}-4-review.png` });
const proj = await p.evaluate(async (pid) => (await fetch('/api/projects/' + pid)).json(), id);
console.log('project', id, 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'scores', JSON.stringify(proj.qa?.scores), 'overall', proj.qa?.overall);
console.log('scenes', proj.spec?.scenes.map((s) => s.type).join(' > '));
console.log('errors', errs.length ? errs : 'none');
await b.close();
