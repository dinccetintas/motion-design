// Scene registry. Every scene: { beats, describe, props, draw(g, p, lt, S), cues(p, S) }.
import * as type from './type.js';
import * as data from './data.js';
import * as graphic from './graphic.js';
import * as media from './media.js';
import * as signature from './signature.js';

export const SCENES = { ...type, ...data, ...graphic, ...media, ...signature };

/** Compact catalog for directors (human or model). */
export const catalog = () => Object.entries(SCENES).map(([type, s]) => ({ type, beats: s.beats, describe: s.describe, props: s.props }));
