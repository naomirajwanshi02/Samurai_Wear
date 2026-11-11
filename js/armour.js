// The Ō-yoroi (大鎧), the "great armour" of the Heian and Kamakura periods, built in code in
// MindAR's canonical face space (centimetres; +z toward the viewer, +x the wearer's left,
// eyes at y ≈ 2.7, chin at y ≈ −9.4, nose tip at z ≈ 7.6).
//
// Checked against period descriptions (see SOURCES.md), chiefly the National Treasure
// red-laced ō-yoroi of Kasuga Taisha (赤絲威鎧, late Kamakura):
//
//   head  — hoshi kabuto (星兜): a black-lacquered iron bowl of riveted plates with large raised
//           rivets (厳星), gilt arrow-tipped strips (篠垂) in six directions (六方白), the gilt
//           seat round the open crown (天辺の座); a visor (眉庇) covered in stencilled leather,
//           with the horn stand (鍬形台) on it bearing a lion's face (獅噛) and the two tall gilt
//           horns (鍬形); a five-lame neck guard hanging down in the cedar shape (杉形錣), red-laced,
//           with cross-knots (菱縫) on the bottom lame, its upper four lames turned back at the
//           front as the big flaps (吹返), faced with stencilled leather; the chin cord (忍緒).
//   face  — happuri (半首): the face guard of the period, an iron plate over the forehead and
//           both cheeks, leaving the eyes, nose and mouth open.
//   torso — the cuirass (胴) with its leather-covered breastplate (胸板) and bowstring panel
//           (弦走韋); the laced right chest guard (栴檀板, three lames) and the solid left chest
//           guard (鳩尾板); shoulder straps with their upright guards (障子の板); the large
//           shoulder guards (大袖, seven lames); and the four-panel box skirt (草摺, five lames).
//
// Later features are deliberately left out: the umbrella neck guard (笠錣, Muromachi) and the
// menpō mask with nose and moustache (from the mid-1400s).

import * as THREE from 'three';
import { faceShell } from './face-fit.js';
import { lamesTexture, grainTexture, egawaTexture } from './paint.js';

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// aka-ito odoshi: black-lacquered scales laced with red silk
const LACE = {
  plate: '#1a0e0a', plateHi: '#3a1a12', plateLo: '#0a0403', gap: '#070403', cord: '#b8341f', cordLo: '#7c1d10', cordHi: '#e8724a',
  dot: '#d8b45a', knot: '#f1e7d2', knot2: '#c2321f', leather: '#e4d9bf', leatherInk: '#2c3f6b', leatherRed: '#a8392b', leatherRim: '#7a2a1b',
  cloud: '#9a7b4a', cloudLo: '#0b0604',
};

// ------------------------------------------------------------------ geometry helpers
// A grid surface f(u, v) → [x, y, z], u and v in 0–1, normals outward when ∂u × ∂v points out.
function surface(nu, nv, f){
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2), idx = [];
  for (let j = 0, k = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++){
    const p = f(i / nu, j / nv);
    pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
    uv[k * 2] = i / nu; uv[k * 2 + 1] = j / nv;
  }
  const at = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++){
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function mirrorX(geo){
  const g = geo.clone();
  g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  if (g.index){ const a = g.index.array; for (let i = 0; i < a.length; i += 3){ const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
  else for (const name of Object.keys(g.attributes)){
    const at = g.attributes[name], s = at.itemSize, a = at.array;
    for (let t = 0; t < at.count; t += 3) for (let c = 0; c < s; c++){ const x = a[(t + 1) * s + c]; a[(t + 1) * s + c] = a[(t + 2) * s + c]; a[(t + 2) * s + c] = x; }
  }
  return g;
}
// Adds a mesh and its mirror image across the face's centre line.
function both(group, geo, mat){
  group.add(new THREE.Mesh(geo, mat), new THREE.Mesh(mirrorX(geo), mat));
}
function tubeGeo(points, radius, { closed = false, seg = 120, radial = 8 } = {}){
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), seg, radius, radial, closed);
}
function tube(points, radius, mat, opts){ return new THREE.Mesh(tubeGeo(points, radius, opts), mat); }
// A gilt rim (fukurin) along one edge of a surface, and its mirror.
function edgeOf(f, which, n = 60){
  const pts = [];
  for (let i = 0; i <= n; i++){ const s = i / n; pts.push(V(...(which === 'top' ? f(s, 1) : which === 'bottom' ? f(s, 0) : which === 'left' ? f(0, s) : f(1, s)))); }
  return pts;
}

// ------------------------------------------------------------------ materials
function M(o){ return new THREE.MeshPhysicalMaterial(o); }
function materials(aniso){
  const gold = M({ color: '#c0913a', metalness: 1, roughness: 0.32, clearcoat: 0.2 });
  const grain = grainTexture({ base: '#1a1310', spot: '#3a2418', streak: '#050302' }, aniso); grain.repeat.set(3, 2);
  const lacquer = M({ color: '#ffffff', map: grain, metalness: 0.2, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.32 });
  const lacquerDS = lacquer.clone(); lacquerDS.side = THREE.DoubleSide;
  const rivet = M({ color: '#241a15', metalness: 0.55, roughness: 0.32, clearcoat: 0.6 });
  const egawa = egawaTexture(aniso);
  const leather = (rx, ry) => { const t = egawa.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return M({ map: t, color: '#cdbd9c', roughness: 0.8, clearcoat: 0.05, envMapIntensity: 0.6, side: THREE.DoubleSide }); };
  const under = M({ color: '#140c08', roughness: 0.9, envMapIntensity: 0.15 });
  const cord = M({ color: '#9b2a1c', roughness: 0.8 });
  return { gold, lacquer, lacquerDS, rivet, leather, under, cord };
}
function lacingMat(spec, aniso){
  const { map, bump } = lamesTexture({ seed: 5, style: 'kebiki', pal: LACE, ...spec }, aniso);
  return M({ map, bumpMap: bump, bumpScale: 2.2, roughness: 0.55, metalness: 0.05, clearcoat: 0.45, clearcoatRoughness: 0.35, side: THREE.DoubleSide });
}

// ------------------------------------------------------------------ the helmet bowl (hoshi-bachi)
// An ellipsoid dome over the head, sized for a head with hair. Its rim sits on the brows at the
// front and drops to the nape at the back, so it covers the hair all round like a head-wear lens.
const BOWL = { cy: 3.3, cz: -4.3, ax: 10.1, ay: 10.3, az: 11.3, yf: 5.8, yb: 0.8 };
export const rimY = (t) => BOWL.yb + (BOWL.yf - BOWL.yb) * (1 + Math.cos(t)) / 2;
function rimPhi(t){ return Math.acos((rimY(t) - BOWL.cy) / BOWL.ay); }
function bowlPoint(t, s, k = 1){
  // t: angle round from the front (+z) toward +x; s: 0 at the crown → 1 at the rim
  const ph = s * rimPhi(t);
  return [k * BOWL.ax * Math.sin(ph) * Math.sin(t), BOWL.cy + BOWL.ay * Math.cos(ph), BOWL.cz + k * BOWL.az * Math.sin(ph) * Math.cos(t)];
}
const PLATES = 16;
const SHINODARE = [0, 0.42, -0.42, Math.PI, Math.PI + 0.42, Math.PI - 0.42]; // 六方白: three in front, three behind

function bowl(mat){
  const g = new THREE.Group(); g.name = 'hachi';
  // sixteen riveted plates, each standing a little proud of the next
  const step = (t, s) => 1 + 0.016 * (1 - ((t / TAU * PLATES) % 1)) * smooth(0.08, 0.3, s);
  g.add(new THREE.Mesh(surface(PLATES * 10, 48, (u, v) => { const t = u * TAU, s = 1 - v; return bowlPoint(t, s, step(t, s)); }), mat.lacquer));
  // 厳星: a row of big raised rivets down every plate, growing toward the rim; none under the strips
  const sph = new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2);
  sph.rotateX(Math.PI / 2); // dome facing +z, turned to the surface below
  const inst = new THREE.InstancedMesh(sph, mat.rivet, PLATES * 8);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const zAxis = V(0, 0, 1);
  let c = 0;
  for (let i = 0; i < PLATES; i++){
    const t = (i + 0.08) / PLATES * TAU;
    if (SHINODARE.some((a) => Math.abs(Math.atan2(Math.sin(t - a), Math.cos(t - a))) < 0.12)) continue;
    for (let k = 0; k < 8; k++){
      const s = 0.3 + k * 0.085;
      p.fromArray(bowlPoint(t, s, 1.016));
      n.fromArray(bowlPoint(t, s, 1.1)).sub(p).normalize();
      q.setFromUnitVectors(zAxis, n);
      const r = 0.24 + 0.2 * s;
      m4.compose(p, q, sc.set(r, r, r * 0.9));
      inst.setMatrixAt(c++, m4);
    }
  }
  inst.count = c;
  g.add(inst);
  // 篠垂: gilt strips running down from the crown, each ending in a leaf-shaped arrow tip
  for (const a of SHINODARE){
    const tipS = 0.72, half = (s) => {
      const w = s < tipS - 0.16 ? 0.38 : s < tipS - 0.07 ? 0.38 + 0.4 * smooth(tipS - 0.16, tipS - 0.09, s) : 0.78 * (1 - smooth(tipS - 0.07, tipS, s));
      return w;
    };
    const f = (u, v) => { const s = 0.07 + v * (tipS - 0.07), r = Math.max(1.2, BOWL.ax * Math.sin(s * rimPhi(a))); return bowlPoint(a + (u - 0.5) * 2 * half(s) / r, s, 1.024); };
    g.add(new THREE.Mesh(surface(6, 40, (u, v) => f(u, 1 - v)), mat.gold));
    for (const s of [0.2, 0.38, tipS - 0.1]){ const r = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), mat.gold); r.position.fromArray(bowlPoint(a, s, 1.035)); g.add(r); }
  }
  // the band round the rim (koshimaki), black with a gilt lower edge
  g.add(new THREE.Mesh(surface(160, 3, (u, v) => bowlPoint(u * TAU, 1 - 0.08 * v, 1.03)), mat.lacquer));
  g.add(tube(Array.from({ length: 97 }, (_, i) => V(...bowlPoint(i / 96 * TAU, 0.995, 1.04))), 0.1, mat.gold, { closed: true, seg: 200 }));
  // 天辺の座: the gilt chrysanthemum seat round the open crown (for the topknot)
  const top = BOWL.cy + BOWL.ay;
  const petals = (R, h, y) => {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 64; i++){ const a = i / 64 * TAU, rr = R * (1 + 0.08 * Math.cos(16 * a)); (i ? shape.lineTo : shape.moveTo).call(shape, Math.cos(a) * rr, Math.sin(a) * rr); }
    shape.holes.push(new THREE.Path().absarc(0, 0, 1.05, 0, TAU, true));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, y, BOWL.cz);
    return new THREE.Mesh(geo, mat.gold);
  };
  g.add(petals(2.7, 0.12, top - 0.55), petals(2.0, 0.14, top - 0.38), petals(1.5, 0.14, top - 0.22));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), M({ color: '#050302', roughness: 1 }));
  hole.rotation.x = -Math.PI / 2; hole.position.set(0, top - 0.05, BOWL.cz);
  g.add(hole);
  return g;
}

// ------------------------------------------------------------------ visor, horn stand, horns
// The visor (眉庇) juts forward from the front of the rim; its top is faced with stencilled
// leather, its underside is dark, and its edge is gilt.
const VISOR_A = 1.3;
function visorAt(u, v){
  const t = (u - 0.5) * 2 * VISOR_A;
  const p = bowlPoint(t, 1, 1.02);
  const L = 3.1 * Math.cos(t * 0.95) ** 0.7 * smooth(VISOR_A, VISOR_A * 0.55, Math.abs(t));
  return [p[0] + Math.sin(t) * L * v, p[1] - 1.3 * L / 3.1 * v + 0.35 * v * v, p[2] + Math.cos(t) * L * v];
}
function visor(mat){
  const g = new THREE.Group(); g.name = 'mabizashi';
  const geo = surface(80, 8, visorAt); // faces down
  const top = mat.leather(3.2, 0.5); top.side = THREE.BackSide;
  g.add(new THREE.Mesh(geo, top), new THREE.Mesh(geo, mat.under));
  g.add(tube(edgeOf(visorAt, 'top', 80), 0.14, mat.gold, { seg: 160 }));
  return g;
}

// The horn stand (鍬形台) sits on the visor; on it a gilt lion's face (獅噛) with jewelled eyes;
// from its two sides rise the gilt horns (鍬形), engraved along their length.
function horns(mat){
  const g = new THREE.Group(); g.name = 'kuwagata';
  const base = visorAt(0.5, 0.35); // on the visor, just in front of the bowl
  const tilt = -0.32;
  const place = (geo, x, y, z = 0) => { geo.rotateX(tilt); geo.translate(base[0] + x, base[1] + y, base[2] + z); return geo; };
  const dai = new THREE.Shape();
  dai.moveTo(-3.1, 0); dai.lineTo(3.1, 0); dai.quadraticCurveTo(3.3, 1.8, 2.3, 2.6); dai.quadraticCurveTo(0, 3.9, -2.3, 2.6); dai.quadraticCurveTo(-3.3, 1.8, -3.1, 0);
  g.add(new THREE.Mesh(place(new THREE.ExtrudeGeometry(dai, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 }), 0, 0.1, -0.2), mat.gold));
  // the lion's face: a domed boss with brows, eyes and a grin
  const boss = new THREE.SphereGeometry(1, 24, 16); boss.scale(1.35, 1.1, 0.55);
  g.add(new THREE.Mesh(place(boss, 0, 1.55, 0.35), mat.gold));
  for (const s of [-1, 1]){
    const eye = new THREE.SphereGeometry(0.26, 12, 8);
    g.add(new THREE.Mesh(place(eye, s * 0.5, 1.85, 0.85), M({ color: '#7a1408', roughness: 0.15, clearcoat: 1 })));
    const brow = new THREE.TorusGeometry(0.42, 0.1, 6, 12, Math.PI * 0.8); brow.rotateZ(Math.PI * 0.1 + (s > 0 ? 0 : Math.PI * 0.0));
    g.add(new THREE.Mesh(place(brow, s * 0.5, 1.95, 0.8), mat.gold));
  }
  const grin = new THREE.TorusGeometry(0.6, 0.11, 6, 16, Math.PI); grin.rotateZ(Math.PI);
  g.add(new THREE.Mesh(place(grin, 0, 1.35, 0.85), mat.gold));
  // one horn: a broad gilt blade sweeping up and out to a rounded tip
  const N = 40, left = [], right = [];
  for (let i = 0; i <= N; i++){
    const t = i / N;
    const cx = 9.5 * t ** 1.6, cy = 16 * t;
    const dx = 9.5 * 1.6 * t ** 0.6 + 1e-3, dy = 16, l = Math.hypot(dx, dy);
    const w = 0.55 + 1.6 * t ** 1.1 + 0.3 * Math.sin(Math.PI * t);
    left.push([cx - dy / l * w, cy + dx / l * w]); right.push([cx + dy / l * w, cy - dx / l * w]);
  }
  const bl = new THREE.Shape();
  bl.moveTo(...left[0]);
  for (const qq of left) bl.lineTo(...qq);
  const tl = left[N], tr = right[N];
  bl.bezierCurveTo(tl[0] + 0.4, tl[1] + 2.4, tr[0] + 1.8, tr[1] + 1.6, tr[0], tr[1]);
  for (let i = N; i >= 0; i--) bl.lineTo(...right[i]);
  bl.lineTo(...left[0]);
  const hg = new THREE.ExtrudeGeometry(bl, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, curveSegments: 12 });
  hg.rotateY(-0.12);
  both(g, place(hg, 2.2, 1.0, -0.1), mat.gold);
  // the engraved line along each blade (the "feather" engraving on the Kasuga horns)
  const groove = [];
  for (let i = 2; i <= N - 2; i++){ const t = i / N; groove.push(V(9.5 * t ** 1.6, 16 * t, 0.32)); }
  const gg = tubeGeo(groove, 0.07, { seg: 60, radial: 5 }); gg.rotateY(-0.12);
  both(g, place(gg, 2.2, 1.0, -0.1), M({ color: '#7a5520', metalness: 1, roughness: 0.5 }));
  return g;
}

// ------------------------------------------------------------------ neck guard and flaps
// 杉形錣: five red-laced lames hanging steeply from the rim like a cedar's outline, not flaring
// flat. Each upper lame laps over the one below. The bottom lame carries the cross-knots.
const SHIKORO = { lames: 5, r0: 10.9, r1: 14.6, depth: 12.6, ez: 1.06, a0: 0.9 };
function shikoro(aniso){
  const S = SHIKORO, g = new THREE.Group(); g.name = 'shikoro';
  const H = S.depth, lh = H / S.lames, over = 0.55;
  const R = (d) => S.r0 + (S.r1 - S.r0) * (Math.max(0, d) / H) ** 1.5;
  const cols = Math.round(((S.r0 + S.r1) / 2) * (TAU - 2 * S.a0));
  const matL = lacingMat({ lames: 1, cols }, aniso), matLast = lacingMat({ lames: 1, cols, knots: true }, aniso);
  const lames = [];
  for (let L = 0; L < S.lames; L++){
    const dT = L * lh - (L ? over : 0) - 0.5, dB = (L + 1) * lh - 0.5;
    const off = 0.3 * (S.lames - L);
    const a0 = S.a0 + 0.07 * L;
    const f = (u, v) => {
      const t = a0 + u * (TAU - 2 * a0), d = dB + (dT - dB) * v, y = rimY(t) - d;
      const r = R(d) + off + 0.4 * (1 - v);
      return [r * Math.sin(t), y, BOWL.cz + 0.2 + r * S.ez * Math.cos(t)];
    };
    const m = new THREE.Mesh(surface(120, 6, f), L === S.lames - 1 ? matLast : matL);
    m.renderOrder = 1;
    g.add(m);
    lames.push(f);
  }
  return { g, lames };
}

// 吹返: the front ends of the upper four lames turned back outward beside the face. The top
// one is the big leather-faced flap with a gilt rim and gilt rosettes; the three below show
// as stepped red-laced ends under it.
function flaps(mat, aniso, lames){
  const g = new THREE.Group(); g.name = 'fukigaeshi';
  const front = lames[0](0, 0.55);
  const T = SHIKORO.a0 + 1.25;
  const u = V(Math.sin(T), 0, Math.cos(T)), v = V(0, 1, 0), n = new THREE.Vector3().crossVectors(u, v);
  const basis = new THREE.Matrix4().makeBasis(u, v, n).setPosition(front[0] + n.x * 0.25, front[1] + 0.6, front[2] + n.z * 0.25);
  const curl = (x) => -0.035 * x * x;
  const W = 7.2;
  const flat = (sh, depth) => {
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++){ uv.setXY(i, p.getX(i) / (W + 0.4), (p.getY(i) + 6) / 12); p.setZ(i, p.getZ(i) + curl(p.getX(i))); }
    geo.applyMatrix4(basis); geo.computeVertexNormals();
    return geo;
  };
  // the leather-faced top flap
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.6); sh.lineTo(W, -0.9); sh.lineTo(W * 0.97, 3.9);
  sh.quadraticCurveTo(W * 0.93, 5.4, W * 0.68, 5.3); sh.lineTo(0, 3.1); sh.lineTo(0, -0.6);
  both(g, flat(sh, 0.35), mat.leather(1.4, 1.4));
  const rim = sh.getPoints(24).map((q) => V(q.x, q.y, 0.45 + curl(q.x)).applyMatrix4(basis));
  both(g, tubeGeo(rim, 0.14, { closed: true, seg: 200 }), mat.gold);
  for (const [x, y] of [[W * 0.78, 3.8], [W * 0.45, 0.3], [W * 0.84, 0.1]]){
    const ro = new THREE.CylinderGeometry(0.45, 0.47, 0.22, 16); ro.rotateX(Math.PI / 2); ro.translate(x, y, 0.52 + curl(x)); ro.applyMatrix4(basis);
    both(g, ro, mat.gold);
  }
  // three stepped, red-laced lame ends below it
  for (let k = 0; k < 3; k++){
    const w = W * (0.9 - 0.12 * k), y1 = -0.75 - k * 1.55, y0 = y1 - 1.75;
    const s2 = new THREE.Shape(); s2.moveTo(0, y0 + 0.1 * k); s2.lineTo(w, y0); s2.lineTo(w, y1); s2.lineTo(0, y1); s2.lineTo(0, y0 + 0.1 * k);
    const geo = flat(s2, 0.25);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    // UVs for the lacing: across = u, down the lame = v
    const inv = basis.clone().invert(), tmp = V(0, 0, 0);
    for (let i = 0; i < p.count; i++){ tmp.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(inv); uv.setXY(i, tmp.x / w, (tmp.y - y0) / (y1 - y0)); }
    both(g, geo, lacingMat({ lames: 1, cols: 7 }, aniso));
  }
  return g;
}

// The chin cord (忍緒) that ties the helmet on, knotted under the chin.
function chinCord(mat){
  const g = new THREE.Group(); g.name = 'shinobi-no-o';
  const pts = [V(-9.2, 2.8, 0.6), V(-8.3, -2.5, 1.4), V(-6.5, -6.6, 2.7), V(-3.4, -9.6, 3.9), V(0, -10.55, 4.25), V(3.4, -9.6, 3.9), V(6.5, -6.6, 2.7), V(8.3, -2.5, 1.4), V(9.2, 2.8, 0.6)];
  g.add(tube(pts, 0.32, mat.cord, { seg: 120, radial: 8 }));
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.22, 48, 8, 2, 3), mat.cord);
  knot.position.set(0, -10.7, 4.3); g.add(knot);
  for (const s of [-1, 1]) g.add(tube([V(s * 0.3, -10.9, 4.4), V(s * 0.6, -12.2, 4.6), V(s * 0.4, -13.6, 4.5)], 0.22, mat.cord, { seg: 20 }));
  return g;
}

// ------------------------------------------------------------------ face guard (happuri)
// 半首: black-lacquered iron over the forehead and down both cheeks, open at the eyes, nose and
// mouth, carved on the face shell a few millimetres off the skin and edged in gilt.
const GAP = 0.5;
function happuri(mat){
  const g = new THREE.Group(); g.name = 'happuri';
  // the brow plate, under the helmet rim, its lower edge arching over the eyebrows
  const brow = (u, v) => {
    const x = (u - 0.5) * 2 * 7.1, yb = 4.25 + 0.012 * x * x, y = yb + (8.2 - yb) * v;
    return [x, y, faceShell(x, y) + GAP];
  };
  // the cheek plates: from below the eye out to the temple, where they join the brow plate
  const xIn = (y) => 2.9 + 0.22 * Math.max(0, 1.2 - y);
  const cheek = (u, v) => {
    const y0 = -6.5 + 1.7 * (1 - u) ** 2, yT = 1.25 + 0.5 * u + 3.6 * smooth(0.62, 0.9, u);
    const y = y0 + (yT - y0) * v, x = xIn(y) + u * (7.35 - xIn(y));
    const z = faceShell(x, y) + GAP + 0.45 + 0.3 * Math.exp(-(((x - 4.1) / 1.4) ** 2) - (((y + 0.4) / 1.3) ** 2));
    return [x, y, z];
  };
  const iron = mat.lacquerDS;
  g.add(new THREE.Mesh(surface(80, 12, brow), iron));
  both(g, surface(40, 40, cheek), iron);
  // gilt edges: along the brow arch and round each cheek plate's open sides
  g.add(tube(edgeOf(brow, 'bottom', 80), 0.13, mat.gold, { seg: 160 }));
  // one open path: along the top (temple → under the eye), down the inner edge, along the jaw
  const path = [...edgeOf(cheek, 'top', 40).reverse(), ...edgeOf(cheek, 'left', 30).reverse().slice(1), ...edgeOf(cheek, 'bottom', 40).slice(1)];
  both(g, tubeGeo(path, 0.13, { seg: 240 }), mat.gold);
  // a gilt rivet at each temple and on each cheekbone
  for (const [x, y] of [[6.6, 4.9], [4.3, -0.6]]){
    const r = new THREE.SphereGeometry(0.26, 12, 8); r.translate(x, y, faceShell(x, y) + GAP + 0.32 + (y < 0 ? 0.7 : 0));
    both(g, r, mat.gold);
  }
  return g;
}

// ------------------------------------------------------------------ torso
// Local to the neck pivot; y down the body, +z forward, +x the wearer's left.
function torso(mat, aniso){
  const g = new THREE.Group(); g.name = 'torso';
  // the cuirass (胴): a broad, boxy front of red-laced lames, nearly as wide at the waist as
  // at the chest (Kamakura), with its upper edge cut down at the armpits
  const cz = -4.2, rx = 16.5, rz = 10.6, A = 1.4, lames = 7, yT0 = -9.6, yB = -40;
  const top = (t) => yT0 - 5 * smooth(0.6, 1.25, Math.abs(t));
  const lh = (yT0 - yB) / lames;
  const fdo = (u, v) => {
    const t = (u - 0.5) * 2 * A, yTop = top(t), y = yB + (yTop - yB) * v;
    const step = 0.35 * (((yT0 - y) / lh) % 1);
    return [rx * Math.sin(t) * (1 + step / rx), y, cz + (rz + step) * Math.cos(t)];
  };
  g.add(new THREE.Mesh(surface(90, 70, fdo), lacingMat({ lames, cols: 52, knots: true }, aniso)));
  // the breastplate (胸板): iron faced with stencilled leather, gilt-edged, across the top
  const MB = 0.62;
  const fmb = (u, v) => { const t = (u - 0.5) * 2 * MB, y = yT0 - 0.2 + 3.4 * v; return [(rx + 0.45) * Math.sin(t), y, cz + (rz + 0.45) * Math.cos(t) - 0.15 * v]; };
  g.add(new THREE.Mesh(surface(40, 6, fmb), mat.leather(2.2, 0.5)));
  for (const w of ['top', 'bottom']) g.add(tube(edgeOf(fmb, w, 40), 0.16, mat.gold, { seg: 80 }));
  // the bowstring panel (弦走韋): stencilled leather down the front, so the bowstring
  // cannot catch on the lacing
  const TB = 0.5;
  const ftb = (u, v) => { const t = (u - 0.5) * 2 * TB, y = -33 + (yT0 - 0.4 - -33) * v; return [(rx + 0.3) * Math.sin(t), y, cz + (rz + 0.38) * Math.cos(t)]; };
  g.add(new THREE.Mesh(surface(30, 30, ftb), mat.leather(1.6, 2.6)));
  for (const w of ['left', 'right', 'bottom']) g.add(tube(edgeOf(ftb, w, 30), 0.12, mat.cord, { seg: 60 }));
  // shoulder straps (肩上) to the back, each with its upright guard (障子の板) by the neck
  for (const s of [-1, 1]){
    g.add(tube([V(s * 8.2, top(0.52) + 0.1, cz + rz * Math.cos(0.52) - 0.3), V(s * 9.4, -6.3, -0.5), V(s * 9.8, -6.6, -7.5)], 0.9, mat.lacquer, { seg: 30, radial: 10 }));
  }
  const sj = new THREE.Shape(); sj.absarc(0, 0, 3.2, 0, Math.PI, false); sj.lineTo(3.2, 0);
  const sjg = new THREE.ExtrudeGeometry(sj, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 });
  const pu = sjg.attributes.position, uvs = sjg.attributes.uv;
  for (let i = 0; i < pu.count; i++) uvs.setXY(i, (pu.getX(i) + 3.2) / 6.4, pu.getY(i) / 3.2);
  sjg.rotateY(Math.PI / 2 - 0.35); sjg.translate(10.6, -5.4, -3.2);
  both(g, sjg, mat.leather(1, 1));
  // the chest guards hanging in front of the armpits: on the right (栴檀板) three laced lames
  // under a leather-faced top plate; on the left (鳩尾板) one solid leather-faced iron plate
  const chestPlate = (x0, laced) => {
    const f = (u, v) => { const x = x0 + (u - 0.5) * 6.4, y = -21.5 + 13.5 * v; return [x, y, 6.9 + 0.7 * Math.cos((x - x0) / 6) - 0.04 * (x - x0) ** 2]; };
    const sub = new THREE.Group();
    if (laced){
      sub.add(new THREE.Mesh(surface(16, 20, (u, v) => f(u, v * 0.78)), lacingMat({ lames: 3, cols: 7, knots: true }, aniso)));
      const kf = (u, v) => f(u, 0.78 + 0.22 * v);
      sub.add(new THREE.Mesh(surface(16, 4, kf), mat.leather(0.8, 0.3)));
      for (const w of ['top', 'bottom']) sub.add(tube(edgeOf(kf, w, 16), 0.12, mat.gold, { seg: 32 }));
    } else {
      const ff = (u, v) => { const p = f(u, v); const taper = 1 - 0.25 * (1 - v); return [x0 + (p[0] - x0) * taper, p[1], p[2]]; };
      sub.add(new THREE.Mesh(surface(16, 20, ff), mat.leather(0.9, 1.6)));
      for (const w of ['left', 'right', 'top', 'bottom']) sub.add(tube(edgeOf(ff, w, 20), 0.14, mat.gold, { seg: 40 }));
    }
    return sub;
  };
  g.add(chestPlate(-11.6, true), chestPlate(11.6, false));
  // the great shoulder guards (大袖): big, nearly flat panels of seven lames under a
  // leather-faced top plate (冠板) with gilt rosettes
  const sw = 15, sh = 27, sx = 20.2, sy0 = -6.6;
  const fs = (u, v) => {
    const a = (u - 0.5) * sw / 22, y = sy0 - 1.6 - (sh - 1.6) * (1 - v);
    const flare = 1 + 0.05 * (1 - v);
    return [sx + 22 * flare * Math.sin(a) * 0.55, y, -1.5 + 22 * flare * (Math.cos(a) - 1) + 0.3 * (1 - v) - (u - 0.5) * 7];
  };
  both(g, surface(40, 50, fs), lacingMat({ lames: 7, cols: 16, knots: true }, aniso));
  const kf = (u, v) => { const p = fs(u, 1); return [p[0], p[1] + 1.8 * v, p[2] - 0.2 * v]; };
  both(g, surface(40, 4, kf), mat.leather(1.6, 0.3));
  for (const w of ['top', 'bottom']) both(g, tubeGeo(edgeOf(kf, w, 40), 0.15, { seg: 80 }), mat.gold);
  for (const u of [0.2, 0.5, 0.8]){ const p = kf(u, 0.5); const r = new THREE.SphereGeometry(0.32, 10, 6); r.translate(p[0], p[1], p[2] + 0.25); both(g, r, mat.gold); }
  // the box skirt (草摺): four panels of five lames — front, left, right (the right one hangs
  // from the separate side guard, 脇楯) and back
  const km = lacingMat({ lames: 5, cols: 14, knots: true }, aniso);
  for (const [t0, t1] of [[-0.62, 0.62], [0.66, 1.42], [-1.42, -0.66]]){
    const f = (u, v) => { const t = t0 + (t1 - t0) * u, y = -57 + 17.5 * v, r = 1 + 0.06 * (1 - v); return [rx * r * Math.sin(t), y, cz + rz * r * Math.cos(t) + 0.3]; };
    g.add(new THREE.Mesh(surface(16, 14, f), km));
  }
  return g;
}

// ------------------------------------------------------------------ occluders
// Depth-only stand-ins for the real head and neck, so the back of the neck guard hides
// behind the wearer instead of drawing across the face.
export function occluders(){
  const mat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const g = new THREE.Group(); g.name = 'occluders';
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mat);
  head.scale.set(7.7, 10.4, 9.0); head.position.set(0, 2.3, -4.7);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.4, 22, 32), mat);
  neck.scale.set(1, 1, 0.95); neck.position.set(0, -16, -3.6);
  for (const m of [head, neck]) m.renderOrder = -1;
  g.add(head, neck);
  return g;
}

// ------------------------------------------------------------------ the whole suit
export function buildSuit(id = 'oyoroi', { aniso = 8, menpo: withFace } = {}){
  const t0 = performance.now();
  const mat = materials(aniso);
  const root = new THREE.Group(); root.name = id;
  const head = new THREE.Group(); head.name = 'kabuto';
  const sk = shikoro(aniso);
  head.add(bowl(mat), visor(mat), horns(mat), sk.g, flaps(mat, aniso, sk.lames), chinCord(mat));
  const face = new THREE.Group(); face.name = 'faceguard';
  face.add(happuri(mat));
  root.add(head, face);
  const body = torso(mat, aniso);
  root.userData = { head, face, body, buildMs: 0 };
  setMenpo(root, withFace ?? true);
  root.userData.buildMs = Math.round(performance.now() - t0);
  return root;
}

// The face guard on or off; the chin cord ties the helmet on either way.
export function setMenpo(root, on){ root.userData.face.visible = on; }

export function disposeSuit(root){
  const seen = new Set();
  for (const r of [root, root.userData.body].filter(Boolean)) r.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)){ seen.add(o.geometry); o.geometry.dispose(); }
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms){
      if (seen.has(m)) continue; seen.add(m);
      for (const k of ['map', 'bumpMap']) if (m[k] && !seen.has(m[k])){ seen.add(m[k]); m[k].dispose(); }
      m.dispose();
    }
  });
}
