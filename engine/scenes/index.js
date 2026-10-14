// Scene registry. Every scene: { beats, describe, props, draw(g, p, lt, S), cues(p, S) }.
import * as type from './type.js';
import * as data from './data.js';
import * as graphic from './graphic.js';
import * as media from './media.js';

export const SCENES = { ...type, ...data, ...graphic, ...media };

/** Compact catalog for directors (human or model). */
export const catalog = () => Object.entries(SCENES).map(([type, s]) => ({ type, beats: s.beats, describe: s.describe, props: s.props }));
