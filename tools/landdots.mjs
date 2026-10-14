// node tools/landdots.mjs  ->  reel/data/land.js (window.LAND = [[lon, lat], ...])
// Samples a regular lon/lat grid against world-atlas land polygons for a dot-matrix map.
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const polys = land.features.flatMap((f) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);

const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const onLand = (x, y) => polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));

const STEP = 1.8, dots = [];
for (let lat = 76; lat >= -56; lat -= STEP)
  for (let lon = -180 + STEP / 2; lon < 180; lon += STEP)
    if (onLand(lon, lat)) dots.push([+lon.toFixed(2), +lat.toFixed(2)]);
writeFileSync('reel/data/land.js', `window.LAND = ${JSON.stringify(dots)};\n`);
console.log(`${dots.length} land dots`);
