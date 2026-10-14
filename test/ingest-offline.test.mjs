// Input classification, number extraction and the offline director's heuristics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, findNumbers, stripDirections, brandPalette } from '../server/ingest.js';
import { parseRequest, parseNumber, short, accentize, dossierFrom, artFrom, directFrom, flapLines, pickParagraph } from '../server/agents/offline.js';
import { repair } from '../engine/schema.js';

test('classify: urls, articles and topics', () => {
  assert.equal(classify('https://stripe.com make it square').kind, 'url');
  assert.equal(classify('stripe.com').url, 'https://stripe.com');
  assert.equal(classify('word '.repeat(90)).kind, 'article');
  const t = classify('How black holes bend time, cinematic, 16:9');
  assert.equal(t.kind, 'topic');
  assert.equal(t.topic, 'How black holes bend time');
});

test('directions are stripped from topics', () => {
  assert.equal(stripDirections('Coffee roasting, 20 seconds, energetic'), 'Coffee roasting');
  assert.equal(stripDirections('Why sleep matters'), 'Why sleep matters');
});

test('numbers come with their sentence; years are not stats', () => {
  const n = findNumbers('Linear powers over 40,000 product teams. Founded in 2019 by three people. Revenue grew 87% last year.');
  assert.deepEqual(n.map((x) => x.raw), ['40,000', '87%']);
});

test('brand palette picks a saturated accent and real grounds', () => {
  const p = brandPalette([['#ffffff', 900], ['#061b31', 300], ['#533afd', 120], ['#64748d', 80]], '', 'rgb(255, 255, 255)');
  assert.equal(p.accent, '#533afd');
  assert.equal(p.dark, '#061b31');
  assert.equal(p.light, '#ffffff');
});

test('plain-language requests', () => {
  assert.equal(parseRequest('make it 16:9 please').format, '16:9');
  assert.equal(parseRequest('for reels').format, '9:16');
  assert.equal(parseRequest('20 seconds').duration, 20);
  assert.equal(parseRequest('more energetic').mood, 'hype');
  assert.equal(parseRequest('use blue as the accent').accent, '#2F55FF');
  assert.equal(parseRequest('switch to the noir style').style, 'noir');
});

test('number parsing and copy helpers', () => {
  assert.deepEqual(parseNumber('$4.2M'), { value: 4.2, prefix: '$', suffix: 'M', decimals: 1 });
  assert.equal(parseNumber('87%').suffix, '%');
  assert.equal(short('The fastest way to ship your product to the world.', 5), 'The fastest way to ship');
  assert.match(accentize('Ship your product faster'), /\*/);
});

test('the offline director makes a renderable film from a page dossier', () => {
  const raw = { kind: 'url', name: 'Acme', host: 'acme.dev', url: 'https://acme.dev', title: 'Acme', description: 'Acme builds rockets for small teams.',
    headings: { h1: ['Rockets for small teams'], h2: ['Launch in days', 'Pay per flight', 'Reusable boosters'], h3: [] }, paragraphs: ['Acme has flown 120 missions since 2021.'],
    ctas: ['Book a launch'], numbers: [{ raw: '120', sentence: 'Acme has flown 120 missions since 2021.' }], brand: { colors: { accent: '#ff3300', dark: '#111111', light: '#fafafa' } }, assets: { hero: 'hero.png', page: 'page.png' } };
  const d = dossierFrom(raw), art = artFrom(d, raw, ''), spec = directFrom(d, art, raw, '');
  const { spec: s, problems } = repair(spec, { assets: ['hero', 'page'] });
  assert.equal(problems.length, 0, problems.join('; '));
  assert.ok(['title', 'flap', 'assemble'].includes(s.scenes[0].type), 'opens on a hook scene');
  assert.equal(s.scenes.at(-1).type, 'endcard');
  assert.ok(s.scenes.some((x) => x.type === 'screen'), 'uses the real screenshot');
  assert.ok(s.scenes.some((x) => x.type === 'counter' && x.props.value === 120), 'uses the real number');
  assert.equal(art.palette.accent, '#ff3300', 'brand accent');
});

test('the offline director quotes the source and uses the phone capture', () => {
  const para = 'Acme turns a weekend of paperwork into one tap, so small teams can book a launch window before lunch.';
  const raw = { kind: 'url', name: 'Acme', host: 'acme.dev', url: 'https://acme.dev', title: 'Acme', description: 'Rockets for small teams.',
    headings: { h1: ['Rockets for small teams'], h2: ['Launch in days', 'Pay per flight'], h3: [] }, paragraphs: ['Log in Sign up Pricing', para],
    ctas: [], numbers: [], brand: { colors: {} }, assets: { page: 'page.png', mobile: 'mobile.png' } };
  const d = dossierFrom(raw), spec = directFrom(d, artFrom(d, raw, ''), raw, '');
  const { spec: s, problems } = repair(spec, { assets: ['page', 'mobile'] });
  assert.equal(problems.length, 0, problems.join('; '));
  const hl = s.scenes.find((x) => x.type === 'highlight');
  assert.ok(hl, 'quotes a real paragraph');
  assert.equal(hl.props.text, para);
  assert.ok(para.includes(hl.props.mark), 'the marked phrase is verbatim');
  assert.ok(s.scenes.some((x) => x.type === 'device' && x.props.image === 'mobile'), 'shows the phone capture');
});

test('split-flap lines fit the board or are refused', () => {
  assert.deepEqual(flapLines('Your idea cut on the beat'), ['YOUR IDEA', 'CUT ON THE', 'BEAT']);
  assert.equal(flapLines('Internationalization everywhere'), null);
  assert.equal(flapLines('one two three four five six seven eight nine ten'), null);
  assert.equal(pickParagraph(['Home Pricing Log in', 'const x = a_b;']), null);
});
