// tools/plates.mjs — pull Higgsfield-generated clips into frame-accurate image sequences.
//
//   node tools/plates.mjs fetch  [plates.json]   download every plate's mp4 into plates/<id>/src.mp4
//   node tools/plates.mjs frames [plates.json]   extract plates/<id>/%05d.jpg at the film fps + meta.json
//   node tools/plates.mjs sheet  <id>            contact sheet of one plate -> out/plate_<id>.png
//   node tools/plates.mjs manifest               rebuild plates/manifest.js from plates/*/meta.json
//
// plates.json: { "fps": 30, "plates": [ { "id": "ink_bloom", "url": "https://…mp4", "job": "…",
//   "model": "kling3_0", "prompt": "…", "in": 0.4, "out": 4.9, "scale": 1920 } ] }
// A <video> element is not frame accurate, so the film page draws these JPEG frames instead.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';

const [cmd, arg = 'plates/plates.json'] = process.argv.slice(2);
const manifestPath = cmd === 'sheet' ? 'plates/plates.json' : arg;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const FPS = manifest.fps || 30;

/** Run ffmpeg/ffprobe and return stdout; throws with the command on failure. */
function run(bin, args) {
  return execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
}

/** Download one plate's source clip if it is not on disk yet. */
function fetchPlate(p) {
  const dir = `plates/${p.id}`;
  mkdirSync(dir, { recursive: true });
  const src = `${dir}/src.mp4`;
  if (existsSync(src)) { console.log(`${p.id}: cached`); return; }
  run('curl', ['-fsSL', '--retry', '3', '-o', src, p.url]);
  console.log(`${p.id}: fetched`);
}

/** Extract the trimmed clip to JPEG frames at the film fps and record what was extracted. */
function framesPlate(p) {
  const dir = `plates/${p.id}`, src = `${dir}/src.mp4`;
  if (!existsSync(src)) throw new Error(`${p.id}: run fetch first`);
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', src]));
  const dur = Number(probe.format.duration);
  const inT = p.in ?? 0, outT = Math.min(p.out ?? dur, dur);
  for (const f of readdirSync(dir)) if (/^\d{5}\.jpg$/.test(f)) execFileSync('rm', [`${dir}/${f}`]);
  const vf = [`fps=${FPS}`, p.scale ? `scale=${p.scale}:-2` : null].filter(Boolean).join(',');
  run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(inT), '-to', String(outT), '-i', src,
    '-vf', vf, '-q:v', '3', `${dir}/%05d.jpg`]);
  const n = readdirSync(dir).filter((f) => /^\d{5}\.jpg$/.test(f)).length;
  const meta = { id: p.id, fps: FPS, frames: n, duration: n / FPS, in: inT, out: outT,
    srcWidth: probe.streams[0].width, srcHeight: probe.streams[0].height, model: p.model, job: p.job, prompt: p.prompt };
  writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 2));
  console.log(`${p.id}: ${n} frames (${meta.duration.toFixed(2)}s)`);
}

/** Tile every 8th frame of a plate for review. */
function sheetPlate(id) {
  mkdirSync('out', { recursive: true });
  run('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `plates/${id}/%05d.jpg`,
    '-vf', `select='not(mod(n\\,8))',scale=320:-1,tile=6x4`, '-frames:v', '1', `out/plate_${id}.png`]);
  console.log(`out/plate_${id}.png`);
}

/** Collect every plates/<id>/meta.json into plates/manifest.js for the film page. */
function writeManifest() {
  const meta = {};
  for (const d of readdirSync('plates', { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(`plates/${d.name}/meta.json`)) meta[d.name] = JSON.parse(readFileSync(`plates/${d.name}/meta.json`, 'utf8'));
  }
  writeFileSync('plates/manifest.js', `window.PLATE_META = ${JSON.stringify(meta)};\n`);
  console.log(`plates/manifest.js: ${Object.keys(meta).length} plates`);
}

if (cmd === 'fetch') manifest.plates.forEach(fetchPlate);
else if (cmd === 'frames') { manifest.plates.forEach(framesPlate); writeManifest(); }
else if (cmd === 'manifest') writeManifest();
else if (cmd === 'sheet') sheetPlate(arg);
else console.log('usage: node tools/plates.mjs fetch|frames|manifest [plates.json] | sheet <id>');
