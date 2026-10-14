// FilmSpec JSON Schema: one exact props schema per scene type. Used for model structured
// outputs and to validate any spec before it reaches the renderer.
import { SCENES } from './scenes/index.js';
import { STYLES } from './styles.js';
import { MOODS } from './audio/score.js';
import { TRANSITION_NAMES } from './transitions.js';

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });
const int = (description) => ({ type: 'integer', description });
const strs = (description) => ({ type: 'array', items: { type: 'string' }, description });
const pair = obj({ label: str('short label'), value: str('the value as displayed, e.g. "45 min"') }, ['label', 'value']);

export const PROPS = {
  title: obj({ text: str('1-6 words; mark ONE accent word like *this*'), sub: str('optional line, <= 8 words') }, ['text']),
  statement: obj({ text: str('one sentence, 6-14 words, one *accent* word'), mode: { type: 'string', enum: ['build', 'karaoke'] } }, ['text']),
  stack: obj({ title: str('optional heading <= 5 words'), items: strs('2-5 items, 1-4 words each') }, ['items']),
  swap: obj({ prefix: str('fixed line, 1-5 words'), words: strs('2-5 single words/short phrases that roll into the slot') }, ['prefix', 'words']),
  marquee: obj({ words: strs('2-4 single words') }, ['words']),
  quote: obj({ text: str('8-26 words, one *accent* phrase'), author: str('who said it'), role: str('optional title or source') }, ['text', 'author']),
  tunnel: obj({ words: strs('3-5 single words; the last is the payoff') }, ['words']),
  justify: obj({ lines: strs('2-5 short lines of 1-3 words; wrap one line in *asterisks* to highlight it') }, ['lines']),
  counter: obj({ value: num('the number'), prefix: str('e.g. "$"'), suffix: str('e.g. "%", "x", "M", "+"'), decimals: int('0-2'), label: str('what it means, <= 9 words, one *accent* word'), from: num('optional start value') }, ['value', 'label']),
  bars: obj({ title: str('optional, <= 6 words'), items: { type: 'array', items: obj({ label: str('<= 3 words'), value: num('number') }, ['label', 'value']), description: '2-5 bars' }, unit: str('e.g. "%", "ms", "x"') }, ['items']),
  linechart: obj({ title: str('optional, <= 6 words'), points: { type: 'array', items: { type: 'number' }, description: '5-12 values' }, value: str('headline at the end, e.g. "+312%"'), label: str('caption, e.g. the time range') }, ['points']),
  compare: obj({ title: str('optional, <= 5 words'), left: pair, right: pair }, ['left', 'right']),
  timeline: obj({ title: str('optional'), items: { type: 'array', items: obj({ label: str('date or step'), text: str('<= 5 words') }, ['label', 'text']), description: '3-4 milestones' } }, ['items']),
  grid: obj({ text: str('optional 1-3 words over the pattern') }),
  orbit: obj({ center: str('1-2 words'), items: strs('4-7 short tags') }, ['center', 'items']),
  globe: obj({ value: str('stat, e.g. "120+ countries"'), label: str('optional caption') }, ['value']),
  chapter: obj({ index: str('e.g. "02"'), title: str('1-5 words') }, ['index', 'title']),
  code: obj({ title: str('optional, <= 6 words'), code: str('3-10 lines of real code, \\n separated, <= 44 chars per line') }, ['code']),
  screen: obj({ image: str('asset key of a screenshot'), title: str('optional, <= 6 words'), url: str('domain'), focus: { type: 'array', items: { type: 'number' }, description: '[x, y] 0-1 point to click' } }, ['image']),
  image: obj({ image: str('asset key of an image'), caption: str('optional, <= 8 words') }, ['image']),
  flap: obj({ lines: strs('1-3 lines, <= 12 characters each; wrap one in *asterisks* for accent') }, ['lines']),
  highlight: obj({ text: str('a paragraph from the source, 15-35 words'), mark: str('exact phrase inside text to highlight, 2-8 words'), source: str('optional source line') }, ['text', 'mark']),
  assemble: obj({ text: str('1-3 words, one *accent*'), sub: str('optional line, <= 8 words') }, ['text']),
  plate: obj({ image: str('asset key of a photograph'), word: str('ONE word, 3-8 letters, naming what the photo shows'), caption: str('optional, <= 8 words, one *accent* word') }, ['image', 'word']),
  device: obj({ image: str('asset key of a mobile screenshot'), title: str('optional headline, <= 6 words'), focus: { type: 'array', items: { type: 'number' }, description: '[x, y] 0-1 point to tap' } }, ['image']),
  endcard: obj({ name: str('brand or film name'), tagline: str('<= 7 words'), cta: str('<= 3 words'), url: str('domain'), logo: str('optional logo asset key') }, ['name']),
};

/** Full FilmSpec schema. `assets` limits which image keys screen/image scenes may use. */
export function filmSchema({ assets = [], logo = null } = {}) {
  const imageKeys = assets.filter((k) => k !== logo && k !== 'mobile');
  // Plates want photographs, not screenshots of a UI.
  const photoKeys = imageKeys.filter((k) => !['page', 'hero'].includes(k));
  const variants = Object.keys(SCENES).filter((t) => {
    if (t === 'screen' || t === 'image') return imageKeys.length > 0;
    if (t === 'plate') return photoKeys.length > 0;
    if (t === 'device') return assets.includes('mobile');
    return true;
  }).map((type) => {
    let props = JSON.parse(JSON.stringify(PROPS[type]));
    if (type === 'screen' || type === 'image') props.properties.image = { type: 'string', enum: imageKeys };
    if (type === 'plate') props.properties.image = { type: 'string', enum: photoKeys };
    if (type === 'device') props.properties.image = { type: 'string', enum: ['mobile'] };
    if (type === 'endcard') { if (logo) props.properties.logo = { type: 'string', enum: [logo] }; else delete props.properties.logo; }
    return obj({
      type: { type: 'string', const: type },
      beats: int(`length in beats (default ${SCENES[type].beats}); 4-8 typical`),
      ground: { type: 'string', enum: ['dark', 'light', 'accent'] },
      transition: { type: 'string', enum: TRANSITION_NAMES, description: 'how this scene enters (ignored on scene 1)' },
      props,
    }, ['type', 'beats', 'ground', 'transition', 'props']);
  });
  return obj({
    title: str('working title of the film'),
    concept: str('the one core mechanic or idea of the film, one sentence'),
    format: { type: 'string', enum: ['9:16', '16:9', '1:1', '4:5'] },
    style: { type: 'string', enum: Object.keys(STYLES) },
    accentStyle: { type: 'string', enum: ['color', 'italic', 'box', 'underline', 'outline'] },
    palette: obj({ dark: str('hex'), light: str('hex'), accent: str('hex') }, ['dark', 'light', 'accent']),
    music: obj({ mood: { type: 'string', enum: Object.keys(MOODS) }, seed: int('any integer') }, ['mood', 'seed']),
    scenes: { type: 'array', items: { anyOf: variants } },
  }, ['title', 'concept', 'format', 'style', 'music', 'scenes']);
}

/** Lightweight validation + repair: drops unknown scenes, clamps copy, returns { spec, problems }. */
export function repair(spec, { assets = [] } = {}) {
  const problems = [];
  const s = JSON.parse(JSON.stringify(spec || {}));
  s.scenes = (s.scenes || []).filter((sc) => {
    if (!SCENES[sc?.type]) { problems.push(`unknown scene type ${sc?.type}`); return false; }
    if (['screen', 'image', 'device', 'plate'].includes(sc.type) && !assets.includes(sc.props?.image)) { problems.push(`${sc.type} uses missing image ${sc.props?.image}`); return false; }
    const req = PROPS[sc.type].required || [];
    for (const k of req) if (sc.props?.[k] == null || (Array.isArray(sc.props[k]) && !sc.props[k].length)) { problems.push(`${sc.type} missing ${k}`); return false; }
    return true;
  });
  if (!s.scenes.length) problems.push('no scenes');
  if (s.palette && !['dark', 'light', 'accent'].every((k) => /^#[0-9a-f]{6}$/i.test(s.palette[k] || ''))) { problems.push('bad palette'); delete s.palette; }
  return { spec: s, problems };
}
