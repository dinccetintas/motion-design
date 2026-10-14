// Style packs: complete visual systems a director can pick from.
// One display face, one text face, one accent, three grounds (dark / light / accent).
// accentStyle decides how *accent* words are set: color | italic | box | underline | outline.
// motion: spring personality for type and objects; camera: drift amount; grain: film texture.
import { contrast, bestOn, mix, luminance } from './core.js';

const F = (family, o = {}) => ({ family, weight: 400, stretch: 100, stretchRange: [100, 100], tracking: 0, caps: false, lineHeight: 0.92, capHeight: 0.72, ...o });

export const STYLES = {
  swiss: {
    name: 'Swiss Pulse', mood: 'precise, confident, grid-led; launches, product news, tech',
    fonts: {
      display: F('Archivo', { weight: 900, stretch: 75, stretchRange: [62, 125], tracking: -0.01, caps: true, lineHeight: 0.86, capHeight: 0.70 }),
      text: F('Inter Tight', { weight: 500, tracking: -0.01 }),
      mono: F('JetBrains Mono', { weight: 500 }),
    },
    palette: { dark: '#0E0E0E', light: '#EFECE6', accent: '#FF3D00' },
    accentStyle: 'color', radius: 0, motion: { type: 'type', obj: 'ui' }, camera: 0.02, grain: 0.05,
  },
  noir: {
    name: 'Signal Noir', mood: 'dark, technical, high-signal; AI, devtools, security, data',
    fonts: {
      display: F('Mona Sans', { weight: 800, stretch: 125, stretchRange: [75, 125], tracking: -0.035, lineHeight: 0.95, capHeight: 0.71 }),
      text: F('Mona Sans', { weight: 500, stretchRange: [75, 125] }),
      mono: F('Geist Mono', { weight: 500 }),
    },
    palette: { dark: '#08090B', light: '#E6EAEE', accent: '#C6FF3D' },
    accentStyle: 'color', radius: 18, motion: { type: 'snap', obj: 'ui' }, camera: 0.025, grain: 0.04,
  },
  folio: {
    name: 'Folio', mood: 'editorial, thoughtful, literate; articles, essays, research, culture',
    fonts: {
      display: F('Instrument Serif', { weight: 400, tracking: -0.015, lineHeight: 0.98, capHeight: 0.66 }),
      text: F('Schibsted Grotesk', { weight: 500 }),
      mono: F('JetBrains Mono', { weight: 400 }),
    },
    palette: { dark: '#0F1626', light: '#F2F0EB', accent: '#2F55FF' },
    accentStyle: 'italic', radius: 6, motion: { type: 'soft', obj: 'ui' }, camera: 0.03, grain: 0.06,
  },
  loud: {
    name: 'Loudspeaker', mood: 'brutal, punchy, loud; announcements, sales, hype, events',
    fonts: {
      display: F('Dela Gothic One', { weight: 400, caps: true, lineHeight: 0.98, capHeight: 0.74, tracking: -0.01 }),
      text: F('JetBrains Mono', { weight: 700, tracking: -0.01 }),
      mono: F('JetBrains Mono', { weight: 700 }),
    },
    palette: { dark: '#111111', light: '#F3F3EE', accent: '#FFE600' },
    accentStyle: 'box', radius: 0, motion: { type: 'snap', obj: 'heavy' }, camera: 0.015, grain: 0.07,
  },
  pastel: {
    name: 'Soft Engine', mood: 'friendly, rounded, optimistic; consumer apps, wellness, education',
    fonts: {
      display: F('Unbounded', { weight: 700, tracking: -0.04, lineHeight: 1.0, capHeight: 0.74 }),
      text: F('Onest', { weight: 500 }),
      mono: F('Geist Mono', { weight: 500 }),
    },
    palette: { dark: '#1A1433', light: '#EEE9FF', accent: '#7C5CFF' },
    accentStyle: 'color', radius: 44, motion: { type: 'type', obj: 'bounce' }, camera: 0.02, grain: 0.03,
  },
  poster: {
    name: 'Tall Poster', mood: 'bold, cinematic, condensed; sports, music, film, campaigns',
    fonts: {
      display: F('Anton', { weight: 400, caps: true, lineHeight: 0.9, capHeight: 0.80, tracking: 0.005 }),
      text: F('Familjen Grotesk', { weight: 600 }),
      mono: F('JetBrains Mono', { weight: 500 }),
    },
    palette: { dark: '#141414', light: '#F1ECE3', accent: '#E8222B' },
    accentStyle: 'color', radius: 0, motion: { type: 'snap', obj: 'heavy' }, camera: 0.03, grain: 0.07,
  },
  luxe: {
    name: 'Quiet Luxury', mood: 'refined, slow, premium; fashion, finance, hospitality, craft',
    fonts: {
      display: F('Fraunces', { weight: 300, tracking: -0.02, lineHeight: 1.0, capHeight: 0.70 }),
      text: F('Instrument Sans', { weight: 500, tracking: 0.02 }),
      mono: F('Geist Mono', { weight: 400 }),
    },
    palette: { dark: '#0D0C0B', light: '#ECE5D8', accent: '#C9A15C' },
    accentStyle: 'italic', radius: 2, motion: { type: 'soft', obj: 'soft' }, camera: 0.035, grain: 0.05,
  },
  pop: {
    name: 'Pop Kit', mood: 'playful, energetic, colorful; creators, games, food, social',
    fonts: {
      display: F('Bricolage Grotesque', { weight: 800, stretch: 75, stretchRange: [75, 100], tracking: -0.03, lineHeight: 0.9, capHeight: 0.72 }),
      text: F('Figtree', { weight: 600 }),
      mono: F('Geist Mono', { weight: 500 }),
    },
    palette: { dark: '#1638FF', light: '#FFF3DF', accent: '#FF5FA2' },
    accentStyle: 'box', radius: 30, motion: { type: 'type', obj: 'bounce' }, camera: 0.02, grain: 0.03,
  },
  machine: {
    name: 'Machine Grade', mood: 'engineered, industrial, wide; hardware, infra, automotive, robotics',
    fonts: {
      display: F('Hubot Sans', { weight: 900, stretch: 125, stretchRange: [75, 125], tracking: -0.02, caps: true, lineHeight: 0.9, capHeight: 0.72 }),
      text: F('Hubot Sans', { weight: 500, stretchRange: [75, 125] }),
      mono: F('Geist Mono', { weight: 500 }),
    },
    palette: { dark: '#0B0E12', light: '#D9DEE4', accent: '#FF6A13' },
    accentStyle: 'outline', radius: 4, motion: { type: 'snap', obj: 'ui' }, camera: 0.02, grain: 0.05,
  },
  funnel: {
    name: 'Momentum', mood: 'modern, clean, kinetic; SaaS, fintech, startups, explainers',
    fonts: {
      display: F('Funnel Display', { weight: 800, tracking: -0.04, lineHeight: 0.92, capHeight: 0.70 }),
      text: F('Funnel Sans', { weight: 500 }),
      mono: F('Geist Mono', { weight: 500 }),
    },
    palette: { dark: '#0F1012', light: '#EDEEE9', accent: '#3B5BFF' },
    accentStyle: 'underline', radius: 22, motion: { type: 'type', obj: 'ui' }, camera: 0.025, grain: 0.035,
  },
};

/** Every font family a style can reference, for preloading. */
export const FAMILIES = [...new Set(Object.values(STYLES).flatMap((s) => Object.values(s.fonts).map((f) => f.family)))];

/**
 * Resolve a style id plus optional brand overrides into a concrete style.
 * Guarantees readable ink on every ground (WCAG >= 4.5 for text where possible).
 */
export function resolveStyle(id, over = {}) {
  const base = STYLES[id] || STYLES.swiss;
  const s = JSON.parse(JSON.stringify(base));
  s.id = STYLES[id] ? id : 'swiss';
  if (over.palette) Object.assign(s.palette, Object.fromEntries(Object.entries(over.palette).filter(([, v]) => /^#[0-9a-f]{3,8}$/i.test(v || ''))));
  if (over.accentStyle) s.accentStyle = over.accentStyle;
  if (over.fonts) for (const role of ['display', 'text']) if (over.fonts[role]) Object.assign(s.fonts[role], typeof over.fonts[role] === 'string' ? { family: over.fonts[role] } : over.fonts[role]);
  const p = s.palette;
  // Grounds must be distinct: if brand gives a dark-ish light, push them apart.
  if (luminance(p.light) < 0.35) p.light = mix(p.light, '#ffffff', 0.85);
  if (luminance(p.dark) > 0.25) p.dark = mix(p.dark, '#000000', 0.75);
  s.grounds = {
    dark: { bg: p.dark, ink: p.light, accent: contrast(p.accent, p.dark) >= 3 ? p.accent : mix(p.accent, p.light, 0.5) },
    light: { bg: p.light, ink: p.dark, accent: contrast(p.accent, p.light) >= 3 ? p.accent : mix(p.accent, p.dark, 0.45) },
    accent: { bg: p.accent, ink: bestOn(p.accent, p.dark, p.light), accent: bestOn(p.accent, p.light, p.dark) },
  };
  // On accent grounds the "accent" word needs a different treatment than color.
  s.grounds.accent.accent = s.grounds.accent.ink;
  return s;
}
