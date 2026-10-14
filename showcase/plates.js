// showcase/plates.js — frame-accurate playback of Higgsfield plates inside a seek(t) film.
// A plate is a folder plates/<id>/00001.jpg… written by tools/plates.mjs, which also writes
// plates/manifest.js (window.PLATE_META) because fetch() of file:// JSON is blocked in Chromium. Frames are decoded
// once at load; drawing frame k for time t is then a pure lookup, so the film stays a pure
// function of time (CLAUDE.md render contract).

const PLATES = {};

/** Load one plate's frames. Resolves once every frame is decoded. */
async function loadPlate(id) {
  const meta = window.PLATE_META[id];       // plates/manifest.js, written by tools/plates.mjs
  if (!meta) throw new Error(`plate ${id} missing from plates/manifest.js`);
  const imgs = [];
  for (let i = 1; i <= meta.frames; i++) {
    const im = new Image();
    im.src = `../plates/${id}/${String(i).padStart(5, '0')}.jpg`;
    imgs.push(im);
  }
  await Promise.all(imgs.map((im) => im.decode().catch(() => {})));
  PLATES[id] = { meta, imgs };
  return PLATES[id];
}

/** Load several plates in parallel. */
function loadPlates(ids) { return Promise.all(ids.map(loadPlate)); }

/** The decoded frame of plate `id` at local time `lt` (seconds since the plate's first frame). */
function plateFrame(id, lt, { hold = true, loop = false } = {}) {
  const p = PLATES[id];
  if (!p) return null;
  let k = Math.floor(lt * p.meta.fps);
  if (loop) k = ((k % p.meta.frames) + p.meta.frames) % p.meta.frames;
  else if (hold) k = Math.max(0, Math.min(p.meta.frames - 1, k));
  else if (k < 0 || k >= p.meta.frames) return null;
  return p.imgs[k];
}

/**
 * Draw plate `id` at local time `lt` covering the rect (x, y, w, h) like CSS object-fit: cover.
 * `zoom` > 1 pushes in around (ax, ay) in 0..1 plate coordinates. Returns false if no frame.
 */
function drawPlate(ctx, id, lt, x, y, w, h, { zoom = 1, ax = 0.5, ay = 0.5, alpha = 1, hold = true, loop = false } = {}) {
  const im = plateFrame(id, lt, { hold, loop });
  if (!im || !im.naturalWidth) return false;
  const iw = im.naturalWidth, ih = im.naturalHeight;
  const s = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * s, dh = ih * s;
  const dx = x + w * ax - dw * ax, dy = y + h * ay - dh * ay;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(im, dx, dy, dw, dh);
  ctx.restore();
  return true;
}
