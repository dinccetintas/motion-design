// node scripts/showcase.mjs  -> measures every film with a "showcase" block and publishes it
// to public/showcase/<id>.json, where the landing page plays it live. Scores are measured, not typed.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { analyze } from '../server/qa.js';
import { closeBrowser } from '../server/renderer.js';

for (const f of readdirSync('films').filter((x) => x.endsWith('.json'))) {
  const film = JSON.parse(readFileSync('films/' + f, 'utf8'));
  if (!film.showcase) continue;
  const { showcase, ...spec } = film;
  const qa = await analyze(spec);
  const id = f.replace('.json', '');
  writeFileSync(`public/showcase/${id}.json`, JSON.stringify({ order: showcase.order, hero: !!showcase.hero, title: spec.title, from: showcase.from, spec, qa: { scores: qa.scores, overall: qa.overall } }, null, 1));
  console.log(id.padEnd(16), JSON.stringify(qa.scores), qa.overall, qa.pass ? 'PASS' : 'FAIL');
  for (const i of qa.issues.filter((x) => x.severity === 'major')) console.log('   ', i.msg);
}
await closeBrowser();
