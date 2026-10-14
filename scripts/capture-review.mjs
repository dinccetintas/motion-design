// node scripts/capture-review.mjs <project-id>  -> screenshots of every surface into .impeccable/review/ for design review.
import { chromium } from 'playwright';
const b = await chromium.launch();
const id = process.argv[2];
const shots = [
  ['landing-desktop', '/', { width: 1440, height: 900 }, true],
  ['landing-mobile', '/', { width: 390, height: 844 }, true],
  ['studio-desktop', `/studio#${id}`, { width: 1440, height: 900 }, false],
  ['studio-mobile', `/studio#${id}`, { width: 390, height: 844 }, true],
  ['studio-empty-desktop', '/studio', { width: 1440, height: 900 }, false],
];
for (const [name, path, vp, full] of shots) {
  const p = await b.newPage({ viewport: vp });
  await p.goto('http://localhost:4100' + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4500);
  if (name === 'studio-desktop') { await p.click('#t-film'); await p.waitForTimeout(300); await p.screenshot({ path: `.impeccable/review/studio-film-tab.png` }); await p.click('#t-review'); await p.waitForTimeout(300); await p.screenshot({ path: `.impeccable/review/studio-review-tab.png` }); await p.click('#t-scene'); }
  await p.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: full });
  await p.close();
}
await b.close();
