// node scripts/shoot.mjs <url> <out-prefix> [--wait ms] [--full]  -> desktop (1440) + mobile (390) screenshots
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const wait = +(process.argv[process.argv.indexOf('--wait') + 1] || 2500);
const full = process.argv.includes('--full');
const b = await chromium.launch();
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(wait);
  await p.screenshot({ path: `${out}-${name}.png`, fullPage: full });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(name, 'errors:', errs.length ? errs.slice(0, 5) : 'none', 'h-overflow:', overflow);
  await p.close();
}
await b.close();
