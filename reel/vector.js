// PROJECT 2, VECTOR (17-29s): product launch. The dashboard is drawn on a 2D canvas that is
// the live texture of a 3D plane, so panels assemble, the cursor works the UI, a card expands,
// and then the camera glides across the tilted interface and pushes into the newest data point.

const VEC = {};
const vb = (n) => at('vec', n);

// Throughput series: 14 points on screen, ten more arrive live (one per beat).
const VEC_VALS = Array.from({ length: 24 }, (_, i) => 62 + 16 * Math.sin(i * 0.7) + 9 * Math.sin(i * 1.9 + 1) + i * 2.1);
const VEC_NEW = [7, 8, 9, 10, 11, 15, 16, 17, 18, 19].map((n) => vb(n));

function initVector() {
  const R = vecRect(), S = V ? 1.5 : 1.6;
  VEC.R = R; VEC.S = S;
  VEC.tex = document.createElement('canvas');
  VEC.tex.width = Math.round(R.w * S); VEC.tex.height = Math.round(R.h * S);
  VEC.tctx = VEC.tex.getContext('2d');
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H, false); r.outputEncoding = THREE.sRGBEncoding;
  VEC.renderer = r;
  VEC.scene = new THREE.Scene();
  VEC.fov = 30; VEC.dist = (H / 2) / Math.tan((VEC.fov / 2) * Math.PI / 180);
  VEC.cam = new THREE.PerspectiveCamera(VEC.fov, W / H, 10, 20000);
  VEC.texture = new THREE.CanvasTexture(VEC.tex);
  VEC.texture.encoding = THREE.sRGBEncoding;
  VEC.texture.anisotropy = r.capabilities.getMaxAnisotropy();
  VEC.plane = new THREE.Mesh(new THREE.PlaneGeometry(R.w, R.h), new THREE.MeshBasicMaterial({ map: VEC.texture, transparent: true }));
  VEC.scene.add(VEC.plane);
  // Dot-grid backdrop far behind the UI: gives parallax while the camera glides.
  const g = document.createElement('canvas'); g.width = g.height = 512;
  const gc = g.getContext('2d'); gc.fillStyle = 'rgba(232,234,240,0.10)';
  for (let y = 16; y < 512; y += 32) for (let x = 16; x < 512; x += 32) { gc.beginPath(); gc.arc(x, y, 2.2, 0, Math.PI * 2); gc.fill(); }
  const gt = new THREE.CanvasTexture(g); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(14, 10);
  VEC.back = new THREE.Mesh(new THREE.PlaneGeometry(7000, 5000), new THREE.MeshBasicMaterial({ map: gt, transparent: true }));
  VEC.back.position.z = -900; VEC.scene.add(VEC.back);
}

// ---------- dashboard texture ----------
function vecLayout() {
  const R = VEC.R;
  if (V) {
    const cw = (R.w - 40 * 2 - 20) / 2;
    return {
      side: null, tabs: { y: 84 }, title: { x: 40, y: 200 },
      cards: [0, 1, 2, 3].map((i) => ({ x: 40 + (i % 2) * (cw + 20), y: 250 + Math.floor(i / 2) * 200, w: cw, h: 180 })),
      chart: { x: 40, y: 670, w: R.w - 80, h: 460 }, table: { x: 40, y: 1150, w: R.w - 80, h: 410 },
      detail: { x: 40, y: 250, w: R.w - 80, h: 1310 }, toggle: { x: R.w - 190, y: 160 },
    };
  }
  const x0 = 290, cw = (R.w - x0 - 30 - 3 * 20) / 4;
  return {
    side: { w: 250 }, tabs: null, title: { x: x0, y: 150 },
    cards: [0, 1, 2, 3].map((i) => ({ x: x0 + i * (cw + 20), y: 190, w: cw, h: 170 })),
    chart: { x: x0, y: 380, w: 760, h: 540 }, table: { x: x0 + 780, y: 380, w: R.w - x0 - 780 - 30, h: 540 },
    detail: { x: x0, y: 190, w: R.w - x0 - 30, h: 730 }, toggle: { x: R.w - 230, y: 112 },
  };
}
const VEC_KPI = [
  ['Revenue', 4.82, 5.16, (v) => `$${v.toFixed(2)}M`, '+7.1%'],
  ['Active seats', 18240, 18912, (v) => Math.round(v).toLocaleString('en-US'), '+3.7%'],
  ['Pipeline', 12.4, 13.1, (v) => `$${v.toFixed(1)}M`, '+5.6%'],
  ['Uptime', 99.97, 99.99, (v) => `${v.toFixed(2)}%`, '30 days'],
];

function vecPanel(c, x, y, w, h, p, pop = true) {
  const s = pop ? lerp(0.92, 1, p) : 1;
  c.save(); c.translate(x + w / 2, y + h / 2 + (1 - p) * 24); c.scale(s, s);
  c.globalAlpha = clamp(p * 1.6);
  c.fillStyle = C.vPanel; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 16); c.fill();
  c.strokeStyle = C.vLine; c.lineWidth = 1.5; c.stroke();
  c.restore();
  return p > 0.01;
}

function chartGeom(t, L) {
  const a = L.chart, area = { x: a.x + 30, y: a.y + 90, w: a.w - 60, h: a.h - 130 };
  const prog = VEC_NEW.map((tk) => typeS(t - tk, 160));
  const Nf = 14 + prog.reduce((s, v) => s + v, 0);
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const p = i < 14 ? 1 : prog[i - 14];
    if (p <= 0.001) break;
    const v = i < 14 ? VEC_VALS[i] : lerp(VEC_VALS[i - 1], VEC_VALS[i], p);
    pts.push([area.x + (i / (Nf - 1)) * area.w, area.y + area.h - ((v - 30) / 130) * area.h]);
  }
  return { area, pts };
}

function drawDashboard(t) {
  const c = VEC.tctx, R = VEC.R, L = vecLayout();
  c.setTransform(VEC.S, 0, 0, VEC.S, 0, 0);
  c.clearRect(0, 0, R.w, R.h);
  c.fillStyle = C.vGraph; c.beginPath(); c.roundRect(0, 0, R.w, R.h, 22); c.fill();
  c.strokeStyle = C.vLine; c.lineWidth = 2; c.stroke();
  const f = (wgt, size) => { c.font = `${wgt} ${size}px ${F.vec}`; };
  const live = t >= vb(7);

  // Brand bar
  const pb = typeS(t - vb(0.5), 200);
  c.save(); c.globalAlpha = clamp(pb * 1.5); c.translate(0, (1 - pb) * -12);
  c.fillStyle = C.vViolet; c.beginPath(); c.moveTo(34, 30); c.lineTo(52, 62); c.lineTo(70, 30); c.lineTo(61, 30); c.lineTo(52, 47); c.lineTo(43, 30); c.fill();
  f(700, 30); c.fillStyle = C.vText; c.fillText('Vector', 82, 57);
  c.restore();

  // Sidebar or tabs
  const items = ['Overview', 'Pipelines', 'Deploys', 'Analytics', 'Settings'];
  const ps = uiS(t - vb(1), 220);
  if (L.side) {
    c.save(); c.translate((ps - 1) * 60, 0); c.globalAlpha = clamp(ps * 1.5);
    c.fillStyle = C.vLine; c.fillRect(L.side.w, 90, 1.5, R.h - 120);
    items.forEach((s, i) => {
      const y = 160 + i * 64, act = i === 0;
      if (act) { c.fillStyle = 'rgba(124,92,255,0.16)'; c.beginPath(); c.roundRect(20, y - 38, L.side.w - 40, 54, 12); c.fill(); c.fillStyle = C.vViolet; c.fillRect(20, y - 30, 4, 38); }
      f(500, 28); c.fillStyle = act ? C.vText : C.vDim; c.fillText(s, 44, y);
    });
    c.restore();
  } else {
    c.save(); c.globalAlpha = clamp(ps * 1.5); c.translate(0, (1 - ps) * 20);
    let x = 40; f(500, 28);
    items.slice(0, 4).forEach((s, i) => { c.fillStyle = i === 0 ? C.vText : C.vDim; c.fillText(s, x, 120); if (i === 0) { c.fillStyle = C.vViolet; c.fillRect(x, 134, c.measureText(s).width, 3); } x += c.measureText(s).width + 36; });
    c.restore();
  }

  // Title + live toggle
  const pt = typeS(t - vb(1.5), 200);
  c.save(); c.globalAlpha = clamp(pt * 1.5); c.translate(0, (1 - pt) * 16);
  f(700, 44); c.fillStyle = C.vText; c.fillText('Overview', L.title.x, L.title.y - (V ? 0 : 42));
  const tg = L.toggle, on = uiS(t - vb(7), 320);
  f(500, 26); c.fillStyle = C.vDim; c.fillText('Live data', tg.x - 130, tg.y + 9);
  c.fillStyle = mix(C.vLine, C.vMint, on); c.beginPath(); c.roundRect(tg.x, tg.y - 18, 72, 36, 18); c.fill();
  c.fillStyle = C.vText; c.beginPath(); c.arc(tg.x + 18 + on * 36, tg.y, 13, 0, Math.PI * 2); c.fill();
  c.restore();

  // KPI cards
  L.cards.forEach((cd, i) => {
    const p = uiS(t - vb(2 + i * 0.5), 240);
    if (!vecPanel(c, cd.x, cd.y, cd.w, cd.h, p)) return;
    const [name, a, b, fmt, delta] = VEC_KPI[i];
    const k = typeS(t - vb(7.3) - i * 0.08, 30);
    c.save(); c.globalAlpha = clamp(p * 1.5); c.translate(0, (1 - p) * 24);
    f(500, 26); c.fillStyle = C.vDim; c.fillText(name, cd.x + 24, cd.y + 46);
    f(700, 52); c.fillStyle = C.vText; c.fillText(fmt(lerp(a, b, k)), cd.x + 24, cd.y + 112);
    f(500, 24); c.fillStyle = i === 3 ? C.vDim : C.vMint; c.fillText(delta, cd.x + 24, cd.y + 150);
    c.restore();
  });

  // Chart
  const pc = uiS(t - vb(4), 220);
  if (vecPanel(c, L.chart.x, L.chart.y, L.chart.w, L.chart.h, pc)) {
    c.save(); c.globalAlpha = clamp(pc * 1.5);
    f(500, 28); c.fillStyle = C.vText; c.fillText('Throughput', L.chart.x + 30, L.chart.y + 50);
    const tw0 = c.measureText('Throughput').width; f(500, 24); c.fillStyle = C.vDim; c.fillText('events / s, last 24 h', L.chart.x + 30 + tw0 + 16, L.chart.y + 50);
    if (live) { c.fillStyle = C.vMint; c.beginPath(); c.arc(L.chart.x + L.chart.w - 110, L.chart.y + 42, 6, 0, 7); c.fill(); f(500, 24); c.fillText('LIVE', L.chart.x + L.chart.w - 96, L.chart.y + 50); }
    const { area, pts } = chartGeom(t, L);
    c.strokeStyle = C.vLine; c.lineWidth = 1;
    for (let g = 0; g <= 4; g++) { const y = area.y + (g / 4) * area.h; c.beginPath(); c.moveTo(area.x, y); c.lineTo(area.x + area.w, y); c.stroke(); }
    const draw = typeS(t - vb(4.3), 25);
    c.strokeStyle = C.vViolet; c.lineWidth = 5; c.lineJoin = 'round';
    const prevCtx = ctx; ctx = c; strokePartial(pts, draw); ctx = prevCtx;
    if (draw > 0.97) {
      const [lx, ly] = pts[pts.length - 1];
      c.fillStyle = C.vGraph; c.beginPath(); c.arc(lx, ly, 11, 0, 7); c.fill();
      c.strokeStyle = C.vViolet; c.lineWidth = 4; c.stroke();
    }
    c.restore();
  }

  // Table
  const pr = uiS(t - vb(5), 220);
  if (vecPanel(c, L.table.x, L.table.y, L.table.w, L.table.h, pr)) {
    c.save(); c.globalAlpha = clamp(pr * 1.5);
    f(500, 28); c.fillStyle = C.vText; c.fillText('Deployments', L.table.x + 28, L.table.y + 50);
    const rows = [['api-gateway', 1], ['billing-sync', 1], ['search-index', live ? 1 : 0], ['edge-cache', 0], ['auth-core', 1]];
    rows.forEach(([n, ok], i) => {
      const y = L.table.y + 116 + i * 82, pp = typeS(t - vb(5.3) - i * 0.06, 220);
      c.save(); c.globalAlpha *= clamp(pp * 1.4); c.translate((1 - pp) * 30, 0);
      c.fillStyle = C.vLine; c.fillRect(L.table.x + 28, y + 30, L.table.w - 56, 1);
      f(500, 26); c.fillStyle = C.vText; c.fillText(n, L.table.x + 28, y + 6);
      const lab = ok ? 'Live' : 'Building', col = ok ? C.vMint : C.vViolet;
      f(500, 24); const tw = c.measureText(lab).width + 28, px = L.table.x + L.table.w - 28 - tw;
      c.fillStyle = rgba(col, 0.16); c.beginPath(); c.roundRect(px, y - 22, tw, 38, 19); c.fill();
      c.fillStyle = col; c.fillText(lab, px + 14, y + 4);
      c.restore();
    });
    c.restore();
  }

  // Detail view: Pipeline card expands (b11), closes (b14)
  const ex = uiS(t - vb(11), 170) - uiS(t - vb(14), 220);
  if (ex > 0.002) {
    const a = L.cards[2], d = L.detail;
    const x = lerp(a.x, d.x, ex), y = lerp(a.y, d.y, ex), w = lerp(a.w, d.w, ex), h = lerp(a.h, d.h, ex);
    c.fillStyle = C.vPanel; c.beginPath(); c.roundRect(x, y, w, h, 16); c.fill();
    c.strokeStyle = C.vViolet; c.lineWidth = 2; c.stroke();
    const pin = typeS(t - vb(11.4), 200) * (1 - typeS(t - vb(13.8), 300));
    c.save(); c.globalAlpha = clamp(pin * 1.4); c.beginPath(); c.rect(x, y, w, h); c.clip();
    f(500, 28); c.fillStyle = C.vDim; c.fillText('Pipeline · Q3 by stage', x + 36, y + 60);
    f(700, 72); c.fillStyle = C.vText; c.fillText('$13.1M', x + 36, y + 150);
    f(500, 28); c.fillStyle = C.vDim; c.fillText('×', x + w - 56, y + 58);
    const st = [['Discovery', 4.2], ['Evaluation', 3.6], ['Proposal', 2.9], ['Negotiation', 1.6], ['Closed won', 0.8]];
    const bw = w - 72 - (V ? 0 : 260), bx = x + 36 + (V ? 0 : 260);
    st.forEach(([n, v], i) => {
      const y0 = y + (V ? 250 : 230) + i * (V ? 190 : 96), g = uiS(t - vb(11.8) - i * 0.09, 200);
      f(500, 28); c.fillStyle = C.vText; c.fillText(n, x + 36, V ? y0 - 20 : y0 + 30);
      const by = V ? y0 : y0, bl = (bw - 120) * (v / 4.2) * g;
      c.fillStyle = i === 4 ? C.vMint : C.vViolet; c.beginPath(); c.roundRect(V ? x + 36 : bx, by, Math.max(0, bl), 44, 10); c.fill();
      f(500, 26); c.fillStyle = C.vText; c.fillText(`$${v.toFixed(1)}M`, (V ? x + 36 : bx) + bl + 16, by + 32);
    });
    c.restore();
  }

  // Cursor
  const cur = vecCursor(t, L);
  if (cur) {
    const [x, y, s, ring] = cur;
    if (ring > 0 && ring < 1) { c.strokeStyle = rgba(C.vText, 0.5 * (1 - ring)); c.lineWidth = 3; c.beginPath(); c.arc(x, y, 14 + ring * 40, 0, 7); c.stroke(); }
    c.save(); c.translate(x, y); c.scale(s * 1.25, s * 1.25);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 30); c.lineTo(8, 23); c.lineTo(13, 34); c.lineTo(18, 32); c.lineTo(13, 21); c.lineTo(23, 21); c.closePath();
    c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1.6; c.stroke();
    c.restore();
  }
  VEC.texture.needsUpdate = true;
}

function vecCursor(t, L) {
  if (t < vb(5.6)) return null;
  const tg = L.toggle, pc = L.cards[2], d = L.detail, R = VEC.R;
  const close = [lerp(pc.x, d.x, 1) + d.w - 50, d.y + 50];
  const xs = [[0, R.w + 60], [vb(6), tg.x + 50], [vb(10), pc.x + pc.w * 0.6], [vb(13), close[0]], [vb(15), R.w * 0.55]];
  const ys = [[0, R.h * 0.7], [vb(6), tg.y + 4], [vb(10), pc.y + pc.h * 0.55], [vb(13), close[1]], [vb(15), R.h * 0.62]];
  const x = uiTrack(t, xs, 90), y = uiTrack(t, ys, 90);
  const clicks = [vb(7), vb(11), vb(14)];
  let s = 1, ring = -1;
  for (const k of clicks) { s *= 1 - 0.15 * (uiS(t - k + 0.08, 900) - uiS(t - k, 500)); if (t >= k && t < k + 0.6) ring = (t - k) / 0.6; }
  return [x, y, s, ring];
}

// ---------- 3D camera ----------
function vecPose(t) {
  const tilt = heavyTrack(t, [[0, 0], [vb(0.6), 1], [vb(15), 0]], 6);
  const glide = heavyTrack(t, [[0, 0], [vb(15), 1]], 5);
  const rotY = tilt * (V ? -0.08 : -0.12) + glide * (V ? -0.36 : -0.42);
  const rotX = tilt * -0.07 + glide * -0.25;
  const camX = glide * (V ? 120 : 260) - heavyTrack(t, [[0, 0], [vb(17), 1]], 5) * (V ? 200 : 420);
  const camZ = VEC.dist * (1 - 0.05 * tilt - 0.12 * glide);
  return { rotY, rotX, camX, camY: glide * -60, camZ };
}

function newestPointWorld(t) {
  const L = vecLayout(), { pts } = chartGeom(t, L), [px, py] = pts[pts.length - 1];
  const v = new THREE.Vector3(px - VEC.R.w / 2, VEC.R.h / 2 - py, 0);
  return v.applyMatrix4(VEC.plane.matrixWorld);
}

function renderVector3D(t) {
  drawDashboard(t);
  const P = vecPose(t);
  VEC.plane.rotation.set(P.rotX, P.rotY, 0); VEC.plane.updateMatrixWorld();
  const cam = VEC.cam, look = new THREE.Vector3(P.camX * 0.4, P.camY * 0.4, 0);
  cam.position.set(P.camX, P.camY, P.camZ);
  // Push into the newest data point (b20).
  const q = heavyS(t - vb(20), 22);
  if (q > 0) {
    const pt = newestPointWorld(t);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(VEC.plane.quaternion);
    const target = pt.clone().add(n.multiplyScalar(260));
    cam.position.lerp(target, q); look.lerp(pt, q);
  }
  cam.lookAt(look); cam.updateMatrixWorld();
  VEC.renderer.render(VEC.scene, cam);
  return cam;
}

function drawVector(t) {
  bg(C.vBg);
  const cam = renderVector3D(t);
  ctx.drawImage(VEC.renderer.domElement, 0, 0, W, H);
  // Handoff: the data point becomes Meridian's origin port on ocean ink.
  if (t >= vb(20.6)) {
    const p = newestPointWorld(t).project(cam);
    const sx = (p.x + 1) / 2 * W, sy = (1 - p.y) / 2 * H;
    const m = merLayout(), port = merProject(MER_PORTS[0][1], MER_PORTS[0][2], m);
    const g = uiS(t - vb(21), 160);
    const x = lerp(sx, port[0], g), y = lerp(sy, port[1], g);
    const r = uiTrack(t, [[0, 26], [vb(21), 60], [vb(21.5), 14]], 200);
    const rmax = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([a, d]) => Math.hypot(a - x, d - y)));
    const iris = rmax * 1.08 * heavyS(t - vb(21), 110);
    ctx.fillStyle = C.mInk; ctx.beginPath(); ctx.arc(x, y, iris, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mix(C.vViolet, C.mAmber, typeS(t - vb(21), 150));
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}
