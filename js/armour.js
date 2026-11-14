// The armour (gusoku 具足), about 1650, in the Metropolitan Museum of Art, New York
// (accession 36.25.41a–q, Bequest of George C. Stone, 1935; helmet signed by Saotome Ietada).
// Built in code to the reference drawing of that armour, in MindAR's canonical face space
// (centimetres; +z toward the viewer, +x the wearer's left, eyes at y ≈ 2.7, chin at y ≈ −9.4).
//
//   head  — black lacquered kabuto bowl with its gilt crown ring; a pale-gold crescent crest
//           (kuwagata) with flared fish-tail tips, a dark-brown crest stand behind it and, in the
//           middle, a gilt ring above a gilt bell-shaped ornament; a black visor and big black side
//           flaps (fukigaeshi) with silver scrollwork and a border of gilt studs; a wide umbrella-
//           shaped neck guard (kasa-jikoro) of black lames with rows of orange studs, the lowest
//           row red-brown; peach-orange silk cords tied under the chin.
//   face  — the menpō: dark iron half mask with a big white horsehair moustache, gilt teeth,
//           silver-lined wrinkles and a round chin, over a gold-laced throat guard (yodare-kake).
//   torso — the cuirass (dō) laced in gold rows with stud rows, its brown centre panel with a
//           silver dragon in clouds, two gold tassels hanging from gilt fittings, an orange cord
//           belt knotted at the front, gold-laced shoulder pieces and shoulder guards (sode),
//           the gold-laced skirt (kusazuri) and the dark scale thigh guard (haidate) with olive
//           knee plates.
// The arm and leg armour in the drawing (kote, suneate) is left out: AR tracks the head, not the limbs.

import * as THREE from 'three';
import { faceZ, faceShell } from './face-fit.js';
import { lamesTexture, grainTexture, karakusaTexture, dragonTexture, haidateTexture, canvas, tex, rng } from './paint.js';

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// palettes for the laced lames
const base = { plate: '#1b1918', plateHi: '#3a3532', plateLo: '#090808', gap: '#060505', knot: '#f1e7d2', knot2: '#c2321f',
  leather: '#e4d9bf', leatherInk: '#2c3f6b', leatherRed: '#a8392b', leatherRim: '#7a2a1b', cloud: '#9a7b4a', cloudLo: '#0b0604' };
const GOLD = { ...base, cord: '#d9b45c', cordLo: '#9c7a33', cordHi: '#f6dd95', dot: '#e3973a' };
const SHIKORO_PAL = { ...base, cord: '#3b2a1f', cordLo: '#22170f', cordHi: '#5a4433', dot: '#e3973a' };
const SHIKORO_LAST = { ...SHIKORO_PAL, plate: '#5a2a1c', plateHi: '#7a3a26', plateLo: '#2a120a' };
const YELLOW = { ...base, cord: '#d6b25e', cordLo: '#a8853c', cordHi: '#f0d68e', dot: '#e3973a', plate: '#141212' };

// ------------------------------------------------------------------ geometry helpers
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
function both(group, geo, mat){ group.add(new THREE.Mesh(geo, mat), new THREE.Mesh(mirrorX(geo), mat)); }
function tubeGeo(points, radius, { closed = false, seg = 120, radial = 8 } = {}){
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), seg, radius, radial, closed);
}
function tube(points, radius, mat, opts){ return new THREE.Mesh(tubeGeo(points, radius, opts), mat); }
function edgeOf(f, which, n = 60){
  const pts = [];
  for (let i = 0; i <= n; i++){ const s = i / n; pts.push(V(...(which === 'top' ? f(s, 1) : which === 'bottom' ? f(s, 0) : which === 'left' ? f(0, s) : f(1, s)))); }
  return pts;
}
// a row of small domed studs along a path of points
function studs(points, r, mat){
  const sph = new THREE.SphereGeometry(1, 10, 6);
  const inst = new THREE.InstancedMesh(sph, mat, points.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(r, r, r * 0.7);
  points.forEach((p, i) => { m4.compose(p, q, s); inst.setMatrixAt(i, m4); });
  return inst;
}

// ------------------------------------------------------------------ materials
function M(o){ return new THREE.MeshPhysicalMaterial(o); }
function materials(aniso){
  const gold = M({ color: '#d9b45c', metalness: 1, roughness: 0.3, clearcoat: 0.2 });
  const paleGold = M({ color: '#ecd393', metalness: 0.85, roughness: 0.35, clearcoat: 0.3, side: THREE.DoubleSide });
  const stud = M({ color: '#e3973a', metalness: 0.9, roughness: 0.3 });
  const grain = grainTexture({ base: '#1b1918', spot: '#34302c', streak: '#050404' }, aniso); grain.repeat.set(3, 2);
  const lacquer = M({ color: '#ffffff', map: grain, metalness: 0.2, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.28 });
  const lacquerDS = lacquer.clone(); lacquerDS.side = THREE.DoubleSide;
  const brown = M({ color: '#5a3520', roughness: 0.7, clearcoat: 0.15, clearcoatRoughness: 0.5, envMapIntensity: 0.4, side: THREE.DoubleSide });
  const bellGold = M({ color: '#d9a640', metalness: 0.9, roughness: 0.38, envMapIntensity: 0.7 });
  const karakusa = (rx, ry, studsOn = false) => { const t = karakusaTexture({ studs: studsOn, aniso }); t.repeat.set(rx, ry); return M({ map: t, roughness: 0.38, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.25, side: THREE.DoubleSide }); };
  const under = M({ color: '#100d0b', roughness: 0.9, envMapIntensity: 0.15 });
  const cord = M({ color: '#f0a06a', roughness: 0.75, sheen: 0.6, sheenColor: new THREE.Color('#ffd2b0') });
  const hair = M({ color: '#f1ece2', roughness: 0.62, sheen: 0.8, sheenColor: new THREE.Color('#ffffff') });
  return { gold, paleGold, stud, lacquer, lacquerDS, brown, bellGold, karakusa, under, cord, hair };
}
function lacingMat(spec, aniso){
  const { map, bump } = lamesTexture({ seed: 5, style: 'kebiki', pal: GOLD, ...spec }, aniso);
  return M({ map, bumpMap: bump, bumpScale: 2.0, roughness: 0.5, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
}

// ------------------------------------------------------------------ the helmet bowl
// Sized for a head with hair; the rim sits on the brows at the front and drops to the nape.
const BOWL = { cy: 3.3, cz: -4.3, ax: 10.1, ay: 10.3, az: 11.3, yf: 5.8, yb: 0.8 };
export const rimY = (t) => BOWL.yb + (BOWL.yf - BOWL.yb) * (1 + Math.cos(t)) / 2;
function rimPhi(t){ return Math.acos((rimY(t) - BOWL.cy) / BOWL.ay); }
function bowlPoint(t, s, k = 1){
  const ph = s * rimPhi(t);
  return [k * BOWL.ax * Math.sin(ph) * Math.sin(t), BOWL.cy + BOWL.ay * Math.cos(ph), BOWL.cz + k * BOWL.az * Math.sin(ph) * Math.cos(t)];
}
const zFront = (y) => { const c = (y - BOWL.cy) / BOWL.ay; return BOWL.cz + BOWL.az * Math.sqrt(Math.max(0, 1 - c * c)); };

function bowl(mat){
  const g = new THREE.Group(); g.name = 'hachi';
  // a ridged bowl (suji-bachi) of 62 plates, as the Saotome school made them, each standing a little proud of the next
  const N = 62;
  const step = (t, s) => 1 + 0.008 * (1 - ((t / TAU * N) % 1)) * smooth(0.08, 0.3, s);
  g.add(new THREE.Mesh(surface(N * 6, 48, (u, v) => { const t = u * TAU, s = 1 - v; return bowlPoint(t, s, step(t, s)); }), mat.lacquer));
  // the band round the rim, with a gilt edge
  g.add(new THREE.Mesh(surface(160, 3, (u, v) => bowlPoint(u * TAU, 1 - 0.08 * v, 1.03)), mat.lacquer));
  g.add(tube(Array.from({ length: 97 }, (_, i) => V(...bowlPoint(i / 96 * TAU, 0.995, 1.04))), 0.09, mat.gold, { closed: true, seg: 200 }));
  // the gilt ring round the crown hole (tehen)
  const top = BOWL.cy + BOWL.ay;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.28, 10, 36), mat.gold);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, top - 0.1, BOWL.cz);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), M({ color: '#050302', roughness: 1 }));
  hole.rotation.x = -Math.PI / 2; hole.position.set(0, top - 0.04, BOWL.cz);
  g.add(ring, hole);
  return g;
}

// ------------------------------------------------------------------ visor and crest
const VISOR_A = 1.25;
function visorAt(u, v){
  const t = (u - 0.5) * 2 * VISOR_A;
  const p = bowlPoint(t, 1, 1.02);
  const L = 2.6 * Math.cos(t * 0.95) ** 0.7 * smooth(VISOR_A, VISOR_A * 0.55, Math.abs(t));
  return [p[0] + Math.sin(t) * L * v, p[1] - 0.9 * L / 2.6 * v + 0.25 * v * v, p[2] + Math.cos(t) * L * v];
}
function visor(mat){
  const g = new THREE.Group(); g.name = 'mabizashi';
  const geo = surface(80, 8, visorAt); // faces down
  const top = mat.karakusa(3, 0.5); top.side = THREE.BackSide;
  g.add(new THREE.Mesh(geo, top), new THREE.Mesh(geo, mat.under));
  g.add(tube(edgeOf(visorAt, 'top', 80), 0.13, mat.gold, { seg: 160 }));
  return g;
}

// The crest: a dark-brown stand rising from the brow, a wide pale-gold crescent (kuwagata) across
// the front with fish-tail tips, and in the middle a gilt ring above a gilt bell-shaped ornament.
function crest(mat){
  const g = new THREE.Group(); g.name = 'kuwagata';
  const y0 = 6.6, z0 = zFront(y0) + 1.0, tilt = -0.22;
  const place = (geo, dz = 0) => { geo.rotateX(tilt); geo.translate(0, y0, z0 + dz); return geo; };
  // the stand: a tall rounded arch of brown lacquer behind everything
  const st = new THREE.Shape();
  st.moveTo(-3.0, 0.6); st.lineTo(-3.0, 5.2); st.quadraticCurveTo(-3.0, 8.4, 0, 8.6); st.quadraticCurveTo(3.0, 8.4, 3.0, 5.2); st.lineTo(3.0, 0.6); st.lineTo(-3.0, 0.6);
  g.add(new THREE.Mesh(place(new THREE.ExtrudeGeometry(st, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 2 }), -0.4), mat.brown));
  // the crescent: outer and inner arcs from tip to tip, the tips flaring into a fish tail
  const cr = new THREE.Shape();
  const outer = (t) => [10.6 * Math.sin(t), 11.5 - 11.5 * Math.cos(t)];
  const inner = (t) => [8.1 * Math.sin(t), 11.5 - 9.6 * Math.cos(t) - 0.4];
  const T = 1.2, n = 40;
  cr.moveTo(...outer(-T));
  for (let i = 1; i <= n; i++) cr.lineTo(...outer(-T + 2 * T * i / n));
  // right tip: flare up and out, with a notch
  const [ox, oy] = outer(T), [ix, iy] = inner(T);
  cr.quadraticCurveTo(ox + 3.0, oy + 0.4, ox + 3.8, oy + 2.6);
  cr.quadraticCurveTo(ox + 0.6, oy + 1.4, ox - 0.2, oy + 2.1);
  cr.quadraticCurveTo(ix + 0.4, iy + 2.2, ix - 0.6, iy + 1.6);
  for (let i = n; i >= 0; i--) cr.lineTo(...inner(-T + 2 * T * i / n));
  const [lix, liy] = inner(-T), [lox, loy] = outer(-T);
  cr.lineTo(lix + 0.6, liy + 1.6);
  cr.quadraticCurveTo(lix - 0.4, liy + 2.2, lox + 0.2, loy + 2.1);
  cr.quadraticCurveTo(lox - 0.6, loy + 1.4, lox - 3.8, loy + 2.6);
  cr.quadraticCurveTo(lox - 3.0, loy + 0.4, lox, loy);
  const cg = new THREE.ExtrudeGeometry(cr, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 12 });
  // bend it round the bowl a little so the tips sit back
  const p = cg.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - 0.035 * p.getX(i) ** 2);
  cg.computeVertexNormals();
  g.add(new THREE.Mesh(place(cg, 0.15), mat.paleGold));
  // three gilt rivets on the crescent
  for (const x of [-2.6, 0, 2.6]){ const r = new THREE.SphereGeometry(0.3, 12, 8); r.translate(x, 0.9 + 0.02 * x * x, 0.5 - 0.035 * x * x); g.add(new THREE.Mesh(place(r, 0.15), mat.gold)); }
  // the bell-shaped gilt ornament with incised bands, and the ring above it
  const bell = new THREE.Shape();
  bell.moveTo(-0.55, 6.4); bell.lineTo(0.55, 6.4); bell.quadraticCurveTo(0.7, 5.2, 1.4, 4.4); bell.quadraticCurveTo(2.0, 3.2, 1.9, 2.0);
  bell.lineTo(1.2, 1.7); bell.lineTo(1.2, 1.2); bell.lineTo(-1.2, 1.2); bell.lineTo(-1.2, 1.7); bell.lineTo(-1.9, 2.0);
  bell.quadraticCurveTo(-2.0, 3.2, -1.4, 4.4); bell.quadraticCurveTo(-0.7, 5.2, -0.55, 6.4);
  g.add(new THREE.Mesh(place(new THREE.ExtrudeGeometry(bell, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 3, curveSegments: 12 }), 0.35), mat.bellGold));
  const inc = M({ color: '#8a6524', metalness: 1, roughness: 0.5 });
  for (const [y, w] of [[2.4, 1.6], [3.4, 1.55], [4.5, 1.05]]){ const b = new THREE.BoxGeometry(2 * w, 0.08, 0.1); b.translate(0, y, 1.0); g.add(new THREE.Mesh(place(b, 0.35), inc)); }
  const ring = new THREE.TorusGeometry(1.35, 0.2, 10, 36); ring.translate(0, 7.9, 0.55);
  g.add(new THREE.Mesh(place(ring, 0.35), mat.bellGold));
  return g;
}

// ------------------------------------------------------------------ neck guard and flaps
// 笠錣: a wide umbrella-shaped neck guard of five black lames with rows of orange studs, the
// lowest lame red-brown, hung from just under the rim all the way round.
const SHIKORO = { lames: 5, r0: 10.9, r1: 21.5, depth: 9.5, ez: 1.05, a0: 0.98 };
function shikoro(aniso){
  const S = SHIKORO, g = new THREE.Group(); g.name = 'shikoro';
  const H = S.depth, lh = H / S.lames, over = 0.5;
  const R = (d) => S.r0 + (S.r1 - S.r0) * (Math.max(0, d) / H) ** 1.05;
  const cols = Math.round(((S.r0 + S.r1) / 2) * (TAU - 2 * S.a0) / 2.6);
  const mk = (pal) => { const { map, bump } = lamesTexture({ seed: 9, style: 'kebiki', pal, lames: 1, cols, plateFrac: 0.62, dots: true }, aniso); return M({ map, bumpMap: bump, bumpScale: 1.6, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.25, side: THREE.DoubleSide }); };
  const matL = mk(SHIKORO_PAL), matLast = mk(SHIKORO_LAST);
  const lames = [];
  for (let L = 0; L < S.lames; L++){
    const dT = L * lh - (L ? over : 0) - 0.5, dB = (L + 1) * lh - 0.5;
    const off = 0.3 * (S.lames - L);
    const a0 = S.a0 + 0.08 * L;
    const f = (u, v) => {
      const t = a0 + u * (TAU - 2 * a0), d = dB + (dT - dB) * v, y = rimY(t) - d;
      const r = R(d) + off + 0.35 * (1 - v);
      return [r * Math.sin(t), y, BOWL.cz + 0.2 + r * S.ez * Math.cos(t)];
    };
    const m = new THREE.Mesh(surface(140, 6, f), L === S.lames - 1 ? matLast : matL);
    m.renderOrder = 1;
    g.add(m);
    lames.push(f);
  }
  return { g, lames };
}

// 吹返: the big side flaps, standing up beside the bowl and facing forward: black lacquer with
// silver scrollwork and a border of gilt studs, edged in gilt.
function flaps(mat, lames){
  const g = new THREE.Group(); g.name = 'fukigaeshi';
  const front = lames[0](0, 0.6);
  const T = SHIKORO.a0 + 1.2;
  const u = V(Math.sin(T), 0, Math.cos(T)), v = V(0, 1, 0), n = new THREE.Vector3().crossVectors(u, v);
  const basis = new THREE.Matrix4().makeBasis(u, v, n).setPosition(front[0] + n.x * 0.3, front[1] + 0.2, front[2] + n.z * 0.3);
  const curl = (x) => -0.03 * x * x;
  const W = 8.2;
  const sh = new THREE.Shape();
  sh.moveTo(0, -1.4); sh.lineTo(W, -2.2); sh.lineTo(W * 1.02, 6.6);
  sh.quadraticCurveTo(W * 0.98, 7.8, W * 0.8, 7.8); sh.lineTo(0.6, 7.0); sh.quadraticCurveTo(0, 6.9, 0, 6.2); sh.lineTo(0, -1.4);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++){ uv.setXY(i, p.getX(i) / (W + 0.4), (p.getY(i) + 2.4) / 10.4); p.setZ(i, p.getZ(i) + curl(p.getX(i))); }
  geo.applyMatrix4(basis); geo.computeVertexNormals();
  both(g, geo, mat.karakusa(1, 1, true));
  const rim = sh.getPoints(24).map((q) => V(q.x, q.y, 0.45 + curl(q.x)).applyMatrix4(basis));
  both(g, tubeGeo(rim, 0.13, { closed: true, seg: 200 }), mat.gold);
  return g;
}

// Peach-orange silk cords (忍緒) from the helmet down the cheeks, crossing over the chin and
// knotted under it.
function chinCord(mat){
  const g = new THREE.Group(); g.name = 'shinobi-no-o';
  const side = (s) => [V(s * 9.4, 2.6, 0.4), V(s * 8.4, -2.4, 1.6), V(s * 6.6, -6.6, 3.3), V(s * 3.6, -9.6, 5.0), V(s * 0.8, -10.9, 5.9)];
  for (const s of [-1, 1]){
    g.add(tube(side(s), 0.42, mat.cord, { seg: 80, radial: 10 }));
    // a second loop crossing the chin
    g.add(tube([V(s * 6.4, -7.0, 3.4), V(s * 3.8, -8.4, 5.4), V(-s * 0.6, -9.9, 6.2), V(-s * 1.4, -11.0, 5.9)], 0.38, mat.cord, { seg: 60, radial: 10 }));
  }
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.85, 0.32, 64, 10, 2, 3), mat.cord);
  knot.position.set(0, -11.1, 6.0); g.add(knot);
  for (const s of [-1, 1]) g.add(tube([V(s * 0.5, -11.6, 6.0), V(s * 1.2, -12.8, 6.2), V(s * 1.6, -13.8, 6.0)], 0.32, mat.cord, { seg: 20 }));
  return g;
}

// ------------------------------------------------------------------ face guard (menpō)
// Dark iron, carved on the face shell with a hooked nose, cheek folds lined in silver, an open
// mouth with gilt teeth and a round chin; a white horsehair moustache sweeps out and down.
const MP = { x0: -7.3, x1: 7.3, y0: -10.6, y1: 3.4 };
const yTop = (x) => 0.75 + 2.35 * Math.exp(-((x / 1.25) ** 2)) + 0.9 * smooth(5, 7.3, Math.abs(x));
const yBot = (x) => -10.0 + 0.11 * x * x;
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));
function segDist(x, y, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
const FOLDS = [[1.9, -1.4, 3.5, -4.8, 0.3], [2.9, -0.8, 4.6, -4.2, 0.22], [3.6, -0.4, 5.6, -3.4, 0.18], [2.4, -6.0, 4.6, -7.2, 0.16]];
function menpoAt(x, y){
  const ax = Math.abs(x);
  let z = faceShell(x, y) + 0.7;
  const nm = Math.exp(-((x / 1.7) ** 2)) * smooth(-2.4, -1.2, y) * (1 - smooth(2.4, 3.6, y));
  z = Math.max(z, (faceZ(x, y) + 0.6) * nm + z * (1 - nm));
  z += 0.45 * gauss(x, y, 0, -0.5, 0.75, 0.9) + 0.3 * gauss(ax, y, 1.35, -1.25, 0.55, 0.45);
  z += 0.4 * gauss(ax, y, 3.9, 0.1, 1.5, 1.2);
  let fold = 0;
  for (const [a, b, c, d, h] of FOLDS) fold = Math.max(fold, h * Math.exp(-((segDist(ax, y, a, b, c, d) / 0.26) ** 2)));
  z += fold;
  z += 0.5 * gauss(x, y, 0, -8.4, 2.4, 1.3); // the round chin
  const e = (x / 2.4) ** 2 + ((y + 4.6) / 0.95) ** 2;
  const lips = smooth(1.15, 0.85, e) * smooth(0.3, 0.5, e);
  const open = smooth(0.42, 0.3, e);
  z += 0.35 * lips - 1.0 * open;
  const teeth = open * (y > -4.6 ? 1 : 0);
  z += 0.55 * teeth;
  return { z, lips, open, teeth, fold };
}
function menpo(mat, aniso){
  const g = new THREE.Group(); g.name = 'menpo';
  const f = (u, v) => { const x = MP.x0 + (MP.x1 - MP.x0) * u, y = yBot(x) + (yTop(x) - yBot(x)) * v; return [x, y, menpoAt(x, y).z]; };
  const geo = surface(130, 96, f);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - MP.x0) / (MP.x1 - MP.x0), (p.getY(i) - MP.y0) / (MP.y1 - MP.y0));
  g.add(new THREE.Mesh(geo, M({ map: paintMenpo(aniso), metalness: 0.45, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25, side: THREE.DoubleSide })));
  const edge = [];
  for (let i = 0; i <= 60; i++) edge.push(V(...f(i / 60, 1)));
  for (let j = 59; j >= 1; j--) edge.push(V(...f(1, j / 60)));
  for (let i = 60; i >= 0; i--) edge.push(V(...f(i / 60, 0)));
  for (let j = 1; j <= 59; j++) edge.push(V(...f(0, j / 60)));
  g.add(tube(edge, 0.16, M({ color: '#1a1513', metalness: 0.5, roughness: 0.4 }), { closed: true, seg: 400 }));
  g.add(moustache(mat));
  return g;
}
// The white horsehair moustache: two thick bundles from under the nose sweeping out and down.
function moustache(mat){
  const r = rng(77), geos = [];
  for (const s of [-1, 1]) for (let k = 0; k < 110; k++){
    const a = r(), b = r() - 0.5;
    const x0 = s * (0.15 + 0.6 * a), y0 = -2.95 - 0.9 * b;
    const zAt = (x, y) => menpoAt(x, y).z + 0.25 + 0.25 * r();
    const pts = [];
    for (let i = 0; i <= 6; i++){
      const t = i / 6;
      const x = x0 + s * (4.0 + 0.8 * b) * Math.sin(t * Math.PI / 2) + s * 0.5 * t * t;
      const y = y0 - 0.4 * t - 2.6 * t ** 2.2 + 0.6 * b * t;
      pts.push(V(x, y, zAt(x, y) + 0.2 + 0.7 * Math.sin(Math.PI * t) * (0.6 + 0.4 * a)));
    }
    geos.push(tubeGeo(pts, 0.11 + 0.08 * r(), { seg: 14, radial: 4 }));
  }
  const merged = mergeAll(geos);
  return new THREE.Mesh(merged, mat.hair);
}
function mergeAll(geos){
  let n = 0, ni = 0;
  for (const g of geos){ n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of geos){
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    const a = g.index.array; for (let i = 0; i < a.length; i++) idx[oi + i] = a[i] + o;
    o += g.attributes.position.count; oi += a.length; g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}
function paintMenpo(aniso){
  const W = 640, H = Math.round(W * (MP.y1 - MP.y0) / (MP.x1 - MP.x0));
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H), d = img.data;
  const r = rng(9);
  const noise = new Float32Array(64 * 64).map(() => r());
  const nz = (x, y) => noise[((x * 4) & 63) + ((y * 4) & 63) * 64];
  for (let j = 0; j < H; j++){
    const y = MP.y1 - (j + 0.5) / H * (MP.y1 - MP.y0);
    for (let i = 0; i < W; i++){
      const x = MP.x0 + (i + 0.5) / W * (MP.x1 - MP.x0);
      const A = menpoAt(x, y), h = 0.3;
      const avg = (menpoAt(x + h, y).z + menpoAt(x - h, y).z + menpoAt(x, y + h).z + menpoAt(x, y - h).z) / 4;
      const cav = Math.max(-1, Math.min(1, (A.z - avg) * 6));
      const n = nz(x * 3, y * 3) * 0.6 + nz(x * 11, y * 11) * 0.4;
      let R = 40 * (0.85 + 0.3 * n), G = 31 * (0.85 + 0.3 * n), B = 27 * (0.85 + 0.3 * n);
      const k = 1 + cav * 0.6; R *= k; G *= k; B *= k;
      // silver lines along the cheek folds
      if (A.fold > 0.12){ const m = Math.min(1, (A.fold - 0.12) * 8); R += (205 - R) * m; G += (200 - G) * m; B += (196 - B) * m; }
      if (A.lips > 0.01){ const m = Math.min(1, A.lips * 1.3); R += (150 - R) * m; G += (64 - G) * m; B += (40 - B) * m; }
      if (A.open > 0.01){
        let tr = 30, tg = 14, tb = 10;
        if (A.teeth > 0.5){ const gap = Math.abs(((x + 10) / 0.5) % 1 - 0.5) < 0.07 || y < -4.3; if (!gap){ tr = 230; tg = 190; tb = 110; } else { tr = 90; tg = 60; tb = 30; } }
        const m = Math.min(1, A.open * 1.6); R += (tr - R) * m; G += (tg - G) * m; B += (tb - B) * m;
      }
      // the small hole under the chin
      if (Math.hypot(x, y + 9.3) < 0.35){ R = G = B = 6; }
      const o = (j * W + i) * 4;
      d[o] = Math.max(0, Math.min(255, R)); d[o + 1] = Math.max(0, Math.min(255, G)); d[o + 2] = Math.max(0, Math.min(255, B)); d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, { aniso });
}
// The throat guard (垂): black lames laced in gold, hanging under the menpō's chin.
function yodare(aniso){
  const g = new THREE.Group(); g.name = 'yodare-kake';
  const lm = lacingMat({ lames: 1, cols: 26, plateFrac: 0.4, dots: true }, aniso);
  const cz = -2.6;
  for (let L = 0; L < 3; L++){
    const yT = -9.4 - L * 2.0, yB = yT - 2.5, r0 = 8.6 + L * 0.95, A = 1.25 + L * 0.07;
    g.add(new THREE.Mesh(surface(60, 4, (u, v) => { const t = (u - 0.5) * 2 * A, y = yB + (yT - yB) * v, r = r0 + 1.1 * (1 - v) + 0.25 * (2 - L); return [r * Math.sin(t), y, cz + r * Math.cos(t)]; }), lm));
  }
  return g;
}

// ------------------------------------------------------------------ torso
// Local to the neck pivot; y down the body, +z forward, +x the wearer's left.
function torso(mat, aniso){
  const g = new THREE.Group(); g.name = 'torso';
  const cz = -4.2, rx = 16.0, rz = 10.6, A = 1.4, yT0 = -8.8, yB = -38;
  const top = (t) => yT0 - 5 * smooth(0.6, 1.25, Math.abs(t));
  // the cuirass: black lames laced in gold rows, with rows of studs between
  const lames = 10, lh = (yT0 - yB) / lames;
  const fdo = (u, v) => {
    const t = (u - 0.5) * 2 * A, yTop = top(t), y = yB + (yTop - yB) * v;
    const step = 0.3 * (((yT0 - y) / lh) % 1);
    return [rx * Math.sin(t) * (1 + step / rx), y, cz + (rz + step) * Math.cos(t)];
  };
  g.add(new THREE.Mesh(surface(90, 80, fdo), lacingMat({ lames, cols: 60, plateFrac: 0.45, dots: true }, aniso)));
  // the collar (eriwa) and top edge
  g.add(tube(edgeOf(fdo, 'top', 60), 0.3, mat.lacquer, { seg: 160 }));
  // the centre panel: brown, with a silver dragon in clouds, edged in silver
  const TB = 0.55;
  const fp = (u, v) => { const t = (u - 0.5) * 2 * TB, y = -33.5 + (-14.5 - -33.5) * v; return [(rx + 0.35) * Math.sin(t), y, cz + (rz + 0.42) * Math.cos(t)]; };
  g.add(new THREE.Mesh(surface(30, 30, fp), M({ map: dragonTexture(aniso), roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide })));
  const silver = M({ color: '#c9c4c0', metalness: 0.9, roughness: 0.3 });
  for (const w of ['left', 'right', 'top', 'bottom']) g.add(tube(edgeOf(fp, w, 30), 0.14, silver, { seg: 60 }));
  // the belt: an orange silk cord round the waist, knotted at the front
  const belt = [];
  for (let i = 0; i <= 50; i++){ const t = (i / 50 - 0.5) * 2 * 1.38; belt.push(V((rx + 0.9) * Math.sin(t), -35.2, cz + (rz + 0.9) * Math.cos(t))); }
  g.add(tube(belt, 0.75, mat.cord, { seg: 120, radial: 10 }));
  const bk = new THREE.Mesh(new THREE.TorusKnotGeometry(1.0, 0.42, 64, 10, 2, 3), mat.cord); bk.position.set(0, -35.2, cz + rz + 1.9); g.add(bk);
  // gold fittings at the top of the chest with their big gold tassels
  for (const s of [-1, 1]){
    const x = s * 7.4, zt = cz + rz * Math.cos(Math.asin(x / rx)) + 0.8;
    const pl = new THREE.Shape(); pl.moveTo(-1.1, 0); pl.lineTo(1.1, 0); pl.lineTo(1.3, 3.6); pl.quadraticCurveTo(0, 4.6, -1.3, 3.6); pl.lineTo(-1.1, 0);
    const pg = new THREE.ExtrudeGeometry(pl, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 });
    pg.translate(x, -14.2, zt); g.add(new THREE.Mesh(pg, mat.gold));
    for (const dx of [-0.5, 0.5]){ const h = new THREE.CircleGeometry(0.28, 12); h.translate(x + dx, -12.0, zt + 0.4); g.add(new THREE.Mesh(h, M({ color: '#1a1410' }))); }
    g.add(tube([V(x, -14.2, zt + 0.2), V(x, -16, zt + 0.5), V(x, -17.4, zt + 0.6)], 0.25, mat.gold, { seg: 12 }));
    const knob = new THREE.SphereGeometry(0.75, 14, 10); knob.scale(1, 1.2, 1); knob.translate(x, -17.9, zt + 0.6); g.add(new THREE.Mesh(knob, mat.gold));
    // the tassel: a flared skirt of gilt threads
    const tas = new THREE.CylinderGeometry(0.6, 1.9, 6.4, 40, 1, true); tas.translate(x, -21.6, zt + 0.7);
    const tp = tas.attributes.position;
    for (let i = 0; i < tp.count; i++){ const a = Math.atan2(tp.getZ(i) - (zt + 0.7), tp.getX(i) - x); const w = 1 + 0.06 * Math.sin(a * 20); tp.setX(i, x + (tp.getX(i) - x) * w); tp.setZ(i, zt + 0.7 + (tp.getZ(i) - zt - 0.7) * w); }
    tas.computeVertexNormals();
    g.add(new THREE.Mesh(tas, M({ color: '#d4ab55', metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide })));
  }
  // shoulder pieces over each shoulder: gold-laced lames curving from the neck to the arm
  const sp = (u, v) => { const t = u * 1.5, x = 9 + 8.5 * Math.sin(t * 0.9) , y = -6.4 - 2.8 * u - 1.2 * v; return [x, y + 0.6 * Math.sin(Math.PI * v), -3.8 + 7.2 * (v - 0.5) * (1 - 0.25 * u)]; };
  both(g, surface(24, 10, sp), lacingMat({ lames: 3, cols: 10, plateFrac: 0.45, dots: true }, aniso));
  // the shoulder guards (sode): curved panels of seven gold-laced lames
  const sw = 13, sh = 21, sx = 19.2, sy0 = -8.4;
  const fs = (u, v) => {
    const a = (u - 0.5) * sw / 16, y = sy0 - 1.2 - (sh - 1.2) * (1 - v);
    const flare = 1 + 0.08 * (1 - v);
    return [sx + 16 * flare * Math.sin(a) * 0.55, y, -1.8 + 16 * flare * (Math.cos(a) - 1) + 0.3 * (1 - v) - (u - 0.5) * 6];
  };
  both(g, surface(40, 50, fs), lacingMat({ lames: 7, cols: 14, plateFrac: 0.5, dots: true }, aniso));
  both(g, tubeGeo(edgeOf(fs, 'top', 40), 0.2, { seg: 80 }), mat.lacquer);
  // the skirt (kusazuri): seven gold-laced panels, the bottom lame studded
  const km = lacingMat({ lames: 7, cols: 10, plateFrac: 0.12, dots: true, pal: YELLOW }, aniso);
  const panels = [[-0.5, -0.02], [0.02, 0.5], [0.54, 1.0], [1.04, 1.42], [-1.0, -0.54], [-1.42, -1.04]];
  for (const [t0, t1] of panels){
    const f = (u, v) => { const t = t0 + (t1 - t0) * u, y = -54 + 17.6 * v, r = 1 + 0.1 * (1 - v); return [rx * r * Math.sin(t), y, cz + rz * r * Math.cos(t) + 0.6]; };
    g.add(new THREE.Mesh(surface(14, 16, f), km));
    g.add(studs(edgeOf(f, 'bottom', 12).map((p) => p.add(V(0, 0.9, 0.3))), 0.32, mat.stud));
  }
  // the thigh guard (haidate) below: dark scales with an olive knee plate on each side
  const hm = M({ map: haidateTexture(aniso), roughness: 0.6, clearcoat: 0.3, side: THREE.DoubleSide });
  for (const s of [-1, 1]){
    const f = (u, v) => { const t = s * (0.08 + 0.75 * u), y = -72 + 20 * v; return [(rx - 2) * Math.sin(t), y, cz + (rz - 1) * Math.cos(t) + 0.2]; };
    g.add(new THREE.Mesh(surface(16, 16, s > 0 ? f : (u, v) => f(1 - u, v)), hm));
  }
  return g;
}

// ------------------------------------------------------------------ occluders
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
export function buildSuit(id = 'gusoku', { aniso = 8, menpo: withFace } = {}){
  const t0 = performance.now();
  const mat = materials(aniso);
  const root = new THREE.Group(); root.name = id;
  const head = new THREE.Group(); head.name = 'kabuto';
  const sk = shikoro(aniso);
  head.add(bowl(mat), visor(mat), crest(mat), sk.g, flaps(mat, sk.lames), chinCord(mat));
  const face = new THREE.Group(); face.name = 'faceguard';
  face.add(menpo(mat, aniso));
  const lower = yodare(aniso);
  head.add(lower);
  root.add(head, face);
  const body = torso(mat, aniso);
  root.userData = { head, face, lower, body, buildMs: 0 };
  setMenpo(root, withFace ?? true);
  root.userData.buildMs = Math.round(performance.now() - t0);
  return root;
}

// The menpō (with its throat guard) on or off; the chin cords tie the helmet on either way.
export function setMenpo(root, on){ root.userData.face.visible = on; root.userData.lower.visible = on; }

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
