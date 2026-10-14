// Projects on disk: data/projects/<id>/project.json plus assets/ and renders/.
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT } from './static.js';

export const DATA = join(ROOT, 'data', 'projects');
mkdirSync(DATA, { recursive: true });

const safeId = (id) => /^[a-z0-9-]{6,40}$/i.test(id || '') ? id : null;
export const dirOf = (id) => join(DATA, safeId(id) || '_invalid_');

export function create(fields = {}) {
  const id = randomUUID().slice(0, 13);
  const p = { id, created: Date.now(), updated: Date.now(), title: 'Untitled film', messages: [], versions: [], renders: [], ...fields };
  mkdirSync(join(dirOf(id), 'assets'), { recursive: true });
  save(p);
  return p;
}
export function load(id) {
  const f = join(dirOf(id), 'project.json');
  if (!safeId(id) || !existsSync(f)) return null;
  return JSON.parse(readFileSync(f, 'utf8'));
}
export function save(p) {
  p.updated = Date.now();
  writeFileSync(join(dirOf(p.id), 'project.json'), JSON.stringify(p, null, 1));
  return p;
}
export function list() {
  if (!existsSync(DATA)) return [];
  return readdirSync(DATA).filter((d) => existsSync(join(DATA, d, 'project.json'))).map((d) => {
    try { const p = JSON.parse(readFileSync(join(DATA, d, 'project.json'), 'utf8')); return { id: p.id, title: p.title, updated: p.updated, format: p.spec?.format, style: p.spec?.style, scores: p.qa?.scores, overall: p.qa?.overall, thumb: p.thumb || null, renders: (p.renders || []).length }; }
    catch { return null; }
  }).filter(Boolean).sort((a, b) => b.updated - a.updated);
}
export const assetUrl = (id, file) => `/data/projects/${id}/assets/${file}`;
