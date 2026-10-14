// Minimal static file serving with path-traversal protection.
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

export const ROOT = resolve(new URL('..', import.meta.url).pathname);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

// URL prefix -> directory. Order matters: first match wins.
export const MOUNTS = [
  ['/engine/', join(ROOT, 'engine')],
  ['/films/', join(ROOT, 'films')],
  ['/data/', join(ROOT, 'data')],
  ['/', join(ROOT, 'public')],
];

/** Resolve a URL path to a file inside a mount, or null. */
export function resolvePath(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  for (const [prefix, dir] of MOUNTS) {
    if (!p.startsWith(prefix)) continue;
    let rel = p.slice(prefix.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const full = normalize(join(dir, rel));
    if (!full.startsWith(dir + sep) && full !== dir) return null;
    try {
      const st = statSync(full);
      if (st.isDirectory()) { const idx = join(full, 'index.html'); statSync(idx); return idx; }
      return full;
    } catch {
      if (prefix === '/' && !extname(rel)) { try { const h = full + '.html'; statSync(h); return h; } catch { /* fallthrough */ } }
    }
  }
  return null;
}

/** Serve a static file; returns false if not found so callers can 404. Supports Range for video. */
export function serveStatic(req, res) {
  const file = resolvePath(req.url);
  if (!file) return false;
  const st = statSync(file), type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Cache-Control': /\/(fonts)\//.test(file) ? 'public, max-age=31536000' : 'no-cache' };
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : st.size - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  }
  return true;
}
