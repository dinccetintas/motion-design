// PROJECT 4, AURA (41-53s): product hero in real 3D (three.js, physical materials, studio
// environment light). Slow orbit, exploded view with self-labelling parts, snap back with
// follow-through, then the whole frame shrinks into a tile of the closing grid.

const AU = {};
const ab = (n) => at('aura', n);
const AU_PARTS = [  // name, spec, explode offset [x, y, z]
  ['tip', 'Memory-foam tip', 'Three sizes', [0, 0, 5.4]],
  ['mesh', 'Acoustic mesh', 'Sweat resistant', [0, 0, 4.4]],
  ['cap', 'Front housing', 'Ceramic finish', [0, 0, 3.4]],
  ['driver', '11 mm driver', 'Custom diaphragm', [0, 0, 2.2]],
  ['chip', 'A1 audio chip', 'Adaptive noise control', [0, 0, 1.2]],
  ['battery', 'Battery', '9 h listening', [0, -1.9, 0]],
];

function initAura() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H, false);
  r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.physicallyCorrectLights = true;
  AU.renderer = r;
  const scene = new THREE.Scene(); AU.scene = scene;
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.03).texture;
  AU.key = new THREE.DirectionalLight(0xffffff, 2.2); scene.add(AU.key);
  const rim = new THREE.DirectionalLight(0xe8e0ff, 1.4); rim.position.set(-4, 2, -5); scene.add(rim);

  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xf4f2ee, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide });
  const silicone = new THREE.MeshPhysicalMaterial({ color: 0xbfb9b2, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6 });
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x2a2826, roughness: 0.45, metalness: 0.4 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xd9d5cf, roughness: 0.12, metalness: 1 });
  const lilac = new THREE.MeshPhysicalMaterial({ color: 0xb9a7ff, roughness: 0.35, metalness: 0.15, clearcoat: 0.6, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshPhysicalMaterial({ color: 0x3b3835, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const meshMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3734, roughness: 0.9, metalness: 0.2 });
  const zAxis = (g) => { g.rotateX(Math.PI / 2); return g; };

  const root = new THREE.Group(); scene.add(root); AU.root = root;
  const parts = {};
  const add = (name, meshes) => { const g = new THREE.Group(); meshes.forEach((m) => g.add(m)); root.add(g); parts[name] = g; return g; };
  // Head: rear shell + front cap (sphere split around the z axis), stem, chrome ring.
  const sq = (g) => { g.scale(1, 0.92, 0.9); return g; };
  const rear = new THREE.Mesh(sq(zAxis(new THREE.SphereGeometry(1, 96, 64, 0, Math.PI * 2, 0.95, Math.PI - 0.95))), pearl);
  const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.45, 16, 48), pearl);
  stem.position.set(0, -1.42, -0.28); stem.rotation.x = 0.16;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.292, 0.028, 16, 64), chrome);
  ring.rotation.x = Math.PI / 2 + 0.16; ring.position.set(0, -1.05, -0.23);
  stem.material = stemMat; ring.material = lilac;
  add('shell', [rear, stem, ring]);
  const cap = new THREE.Mesh(sq(zAxis(new THREE.SphereGeometry(1, 96, 32, 0, Math.PI * 2, 0, 0.95))), pearl);
  const nozzle = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.26, 0.3, 0.42, 64, 1, true)), pearl);
  nozzle.position.z = 0.95;
  add('cap', [cap, nozzle]);
  const tipProfile = [[0.27, 0], [0.31, 0.02], [0.55, 0.16], [0.63, 0.3], [0.58, 0.44], [0.4, 0.53], [0.27, 0.5], [0.25, 0.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const tip = new THREE.Mesh(zAxis(new THREE.LatheGeometry(tipProfile, 96)), silicone); tip.position.z = 0.98;
  add('tip', [tip]);
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.255, 64), meshMat); mesh.position.z = 1.16;
  add('mesh', [mesh]);
  const dRing = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.055, 24, 96), chrome);
  const cone = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.56, 0.16, 0.16, 96, 1, true)), lilac);
  const magnet = new THREE.Mesh(zAxis(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 48)), graphite); magnet.position.z = -0.12;
  const drv = add('driver', [dRing, cone, magnet]); drv.position.z = 0.42;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.06), graphite);
  const die = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.05), chrome); die.position.z = 0.05;
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), lilac); dot.position.set(0.3, -0.16, 0.05);
  const chip = add('chip', [board, die, dot]); chip.position.z = 0.02;
  const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.95, 48), graphite);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.12, 48), lilac); band.position.y = 0.35;
  const bat = add('battery', [cell, band]); bat.position.set(0, -1.5, -0.28); bat.rotation.x = 0.16;
  AU.parts = parts;
  AU.base = Object.fromEntries(Object.entries(parts).map(([k, g]) => [k, g.position.clone()]));
  AU.cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
  AU.frame = document.createElement('canvas'); AU.frame.width = W; AU.frame.height = H;
}

// Screen position of the object centre (the earbud head sits here at 41s).
function auraAnchor(t = ab(0)) {
  const e = heavyTrack(t, [[0, 0], [ab(8), 1], [ab(16.2), 0]], 3);
  return V ? [CX, CY - 190 + 260 * e] : [CX + 300 - 330 * e, CY - 30 - 40 * e];
}

function auraPose(t) {
  const yaw = heavyTrack(t, [[0, 0], [ab(0.2), -0.75], [ab(8), V ? -0.45 : -1.62], [ab(16.4), -0.62]], 2.2) - 0.02 * Math.max(0, t - ab(0));
  const pitch = heavyTrack(t, [[0, 0], [ab(0.2), 0.16], [ab(8), 0.1], [ab(16.4), 0.2]], 2.2);
  const dist = heavyTrack(t, [[0, V ? 14 : 9.5], [ab(8), V ? 26 : 15.5], [ab(16.4), V ? 14 : 9.8]], 3);
  const tz = heavyTrack(t, [[0, 0], [ab(8.4), 3.3], [ab(16.2), 0]], 3);
  return { yaw, pitch, dist, tz };
}

// Camera framed so the object centre lands on auraAnchor() (shift the view, not the object).
function auraSetCamera(t) {
  const P = auraPose(t), cam = AU.cam, target = new THREE.Vector3(0, V ? -0.4 : -0.5, 0);
  if (V) AU.root.rotation.set(-1.25 * heavyTrack(t, [[0, 0], [ab(7.6), 1], [ab(16.2), 0]], 4), 0, 0); else AU.root.rotation.set(0, 0, 0);
  target.z += P.tz * (V ? 0.4 : 1);
  if (V) target.y += P.tz * 0.85;
  cam.position.set(target.x + P.dist * Math.sin(P.yaw) * Math.cos(P.pitch), target.y + P.dist * Math.sin(P.pitch), target.z + P.dist * Math.cos(P.yaw) * Math.cos(P.pitch));
  cam.lookAt(target);
  const [ax, ay] = auraAnchor(t);
  cam.setViewOffset(W, H, -(ax - CX), -(ay - CY), W, H);
  cam.updateMatrixWorld();
  return cam;
}

// Disc the Meridian iris closes onto: the earbud head as seen at 41s.
function auraFrontDisc() {
  if (AU.disc) return AU.disc;
  const cam = auraSetCamera(ab(0));
  AU.root.updateMatrixWorld();
  const c = new THREE.Vector3(0, 0, 0).project(cam), e = new THREE.Vector3(0, 0.92, 0).project(cam);
  const x = (c.x + 1) / 2 * W, y = (1 - c.y) / 2 * H;
  AU.disc = { x, y, r: Math.abs((1 - e.y) / 2 * H - y) };
  return AU.disc;
}

function drawAuraBackdrop() {
  ctx.fillStyle = C.aPearl; ctx.fillRect(0, 0, W, H);
  const [ax, ay] = auraAnchor();
  const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, Math.hypot(W, H) * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(1, 'rgba(120,110,100,0.16)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function auraExplode(t, i) {
  return uiS(t - ab(8) - i * BEAT * 0.5, 160) - spring(t - ab(16) - i * 0.04, 300, 0.55 * 2 * Math.sqrt(300));
}

// Full Aura frame (backdrop + 3D + labels) at time t into the current ctx.
function drawAuraScene(t) {
  drawAuraBackdrop();
  const cam = auraSetCamera(t);
  AU_PARTS.forEach(([k, , , off], i) => {
    const e = auraExplode(t, i), b = AU.base[k];
    AU.parts[k].position.set(b.x + off[0] * e, b.y + off[1] * e, b.z + off[2] * e);
  });
  const sweep = heavyTrack(t, [[0, 0], [ab(17), 1]], 3);
  AU.key.position.set(5 * Math.cos(1.1 + sweep * 2.2), 4, 5 * Math.sin(1.1 + sweep * 2.2));
  AU.root.updateMatrixWorld();
  // Soft contact shadow under the object.
  const lo = new THREE.Vector3(0, -2.2, 0).applyMatrix4(AU.root.matrixWorld).project(cam);
  const sx = (lo.x + 1) / 2 * W, sy = (1 - lo.y) / 2 * H + 40;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 260);
  sg.addColorStop(0, 'rgba(60,50,40,0.20)'); sg.addColorStop(1, 'rgba(60,50,40,0)');
  ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.18); ctx.translate(-sx, -sy); ctx.fillStyle = sg; ctx.fillRect(sx - 300, sy - 300, 600, 600); ctx.restore();
  AU.renderer.render(AU.scene, cam);
  ctx.drawImage(AU.renderer.domElement, 0, 0, W, H);

  // Labels with leader lines (b9-b15).
  AU_PARTS.forEach(([k, name, spec], i) => {
    const p = typeS(t - ab(8.6) - i * BEAT * 0.5, 200) * (1 - typeS(t - ab(15.4), 260));
    if (p <= 0.01) return;
    const wp = new THREE.Box3().setFromObject(AU.parts[k]).getCenter(new THREE.Vector3());
    const s = wp.project(cam), x = (s.x + 1) / 2 * W, y = (1 - s.y) / 2 * H;
    const [, ay] = auraAnchor(t);
    const up = i === 5 ? 1 : (i % 2 ? 1 : -1);
    const side = V || i === 5;
    const lx = side ? (up < 0 && i !== 5 ? x - 150 : x + 150) : x, ly = side ? y : ay + up * 290;
    ctx.strokeStyle = rgba(C.aGraph, 0.55); ctx.lineWidth = 2;
    strokePartial([[x, y], [lx, ly]], p);
    ctx.fillStyle = C.aGraph; ctx.beginPath(); ctx.arc(x, y, 5 * p, 0, 6.283); ctx.fill();
    const al = side ? (up < 0 && i !== 5 ? 'right' : 'left') : 'center', ty = side ? ly + 10 : ly + (up < 0 ? -48 : 44);
    font(500, 32, F.aura); riseText(name, lx, ty, 32, p, { color: C.aGraph, align: al });
    font(500, 26, F.aura); riseText(spec, lx, ty + 36, 26, typeS(t - ab(8.8) - i * BEAT * 0.5, 200) * (1 - typeS(t - ab(15.4), 260)), { color: C.aGrey, align: al });
  });

  // Wordmark (b2-b7).
  const out = 1 - typeS(t - ab(7.2), 220);
  const tx = V ? 90 : 170, ty = V ? H - 520 : CY + 30;
  font(200, V ? 200 : 230, F.aura);
  riseText('Aura', tx - 8, ty, V ? 200 : 230, typeS(t - ab(2), 120) * out, { color: C.aGraph });
  font(500, 40, F.aura);
  riseText('Hear less of everything else.', tx, ty + 90, 40, typeS(t - ab(3), 200) * out, { color: C.aGraph });
  font(500, 28, F.aura);
  riseText('Spec project · product hero', tx, ty + 150, 28, typeS(t - ab(4), 200) * out, { color: C.aGrey });
}

function drawAura(t) {
  const shrink = heavyS(t - ab(20), 60);
  if (shrink <= 0.0005) drawAuraScene(t);
  else {
    withCtx(AU.frame.getContext('2d'), () => drawAuraScene(t));
    bg(C.black);
    const R = closeTileRect(11);
    const x = lerp(0, R.x, shrink), y = lerp(0, R.y, shrink), w = lerp(W, R.w, shrink), h = lerp(H, R.h, shrink);
    ctx.save(); rr(x, y, w, h, lerp(0, 14, shrink)); ctx.clip();
    ctx.drawImage(AU.frame, x, y, w, h); ctx.restore();
  }
  // Handoff in: the amber disc turns pearl and lets go of the head; the stem is wiped in.
  const d = auraFrontDisc(), k = typeS(t - ab(0), 160);
  if (k < 0.995) {
    const a = 1 - typeS(t - ab(0.25), 120);
    ctx.save();
    ctx.globalAlpha = a; ctx.fillStyle = mix(C.mAmber, C.aPearl, k);
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
    ctx.restore();
  }
}
