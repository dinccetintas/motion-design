// Input classification, number extraction and the offline director's heuristics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, findNumbers, stripDirections, brandPalette } from '../server/ingest.js';
import { parseRequest, parseNumber, short, accentize, dossierFrom, artFrom, directFrom } from '../server/agents/offline.js';
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
  assert.equal(s.scenes[0].type, 'title');
  assert.equal(s.scenes.at(-1).type, 'endcard');
  assert.ok(s.scenes.some((x) => x.type === 'screen'), 'uses the real screenshot');
  assert.ok(s.scenes.some((x) => x.type === 'counter' && x.props.value === 120), 'uses the real number');
  assert.equal(art.palette.accent, '#ff3300', 'brand accent');
});
