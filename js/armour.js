// The two suits, built in code in MindAR's canonical face space (centimetres; +z toward
// the viewer, eyes at y ≈ 2.7, chin at y ≈ −9.4, nose tip at z ≈ 7.6).
//
//   head   — rides the whole-face pose: kabuto bowl (hachi) with its riveted plates, rim band,
//            visor (mabizashi), neck guard (shikoro), turned-back flaps (fukigaeshi), crest or
//            golden horns (kuwagata), and the iron face guard (menpō) with its throat guard
//            (yodare-kake) — or a chin cord when the face is bare.
//   torso  — hangs from the neck: cuirass (dō), shoulder guards (sode) and skirt (kusazuri).
//
// Tōsei gusoku follows reference 1 (russet iron, blue lacing, red-lipped menpō);
// Ō-yoroi follows reference 2 (black bowl, gilt kuwagata, red lacing, stencilled leather).

import * as THREE from 'three';
import { faceZ, faceShell } from './face-fit.js';
import { lamesTexture, grainTexture, crestTexture, leatherTexture, canvas, tex, rng } from './paint.js';

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ styles
const STYLES = {
  tosei: {
    bowl: { color: '#6a3f29', metal: 0.55, rough: 0.5, grain: { base: '#6a3f29', spot: '#a45a2c', streak: '#2d170c' } },
    rivet: { color: '#7a4a30', metal: 0.6, rough: 0.4 },
    band: '#2a1810',
    visor: '#4a2a1b',
    plates: 32,
    shikoro: { lames: 5, r0: 10.6, r1: 19.5, y0: 4.6, y1: -6.6, ez: 1.08, a0: 1.02 },
    lacing: { style: 'sugake', pal: pal('#231610', '#4a3020', '#0e0805', '#3f86a8', '#22566f', '#7fc0dc', '#c9a24a') },
    sodeLacing: { style: 'kebiki', dots: true, pal: pal('#1d120c', '#4a3020', '#0e0805', '#3c7ea0', '#1f4e66', '#78bad6', '#d8b45a') },
    doLacing: { style: 'kebiki', plateFrac: 0.55, dots: true, clouds: true, pal: pal('#21140d', '#4b3121', '#0b0604', '#3f86a8', '#22566f', '#7fc0dc', '#d8b45a') },
    flap: { kind: 'lacquer', color: '#22140d' },
    crest: false, horns: false, crestDisc: true,
    menpo: { iron: [74, 42, 28], rust: [128, 68, 34] },
    ring: true,
  },
  oyoroi: {
    bowl: { color: '#191210', metal: 0.2, rough: 0.45, grain: { base: '#1a1310', spot: '#3a2418', streak: '#050302' } },
    rivet: { color: '#2b211b', metal: 0.7, rough: 0.35 },
    band: '#c49a46',
    visor: '#140e0b',
    plates: 24,
    shikoro: { lames: 5, r0: 10.6, r1: 16.2, y0: 4.6, y1: -8.4, ez: 1.06, a0: 1.05 },
    lacing: { style: 'kebiki', knots: true, pal: pal('#3a0f0b', '#5e1d15', '#160604', '#b8341f', '#7c1d10', '#e8724a', '#d8b45a') },
    sodeLacing: { style: 'kebiki', knots: true, pal: pal('#3a0f0b', '#5e1d15', '#160604', '#b8341f', '#7c1d10', '#e8724a', '#d8b45a') },
    doLacing: { style: 'kebiki', knots: true, pal: pal('#3a0f0b', '#5e1d15', '#160604', '#b8341f', '#7c1d10', '#e8724a', '#d8b45a') },
    flap: { kind: 'leather' },
    crest: false, horns: true, crestDisc: false,
    menpo: { iron: [44, 30, 26], rust: [80, 50, 36] },
    ring: false,
  },
};
function pal(plate, plateHi, plateLo, cord, cordLo, cordHi, dot){
  return { plate, plateHi, plateLo, gap: '#070403', cord, cordLo, cordHi, dot, knot: '#f1e7d2', knot2: '#c2321f',
    leather: '#c9d6d8', leatherInk: '#284a76', leatherRed: '#b5402f', leatherRim: '#7a2a1b', cloud: '#9a7b4a', cloudLo: '#0b0604' };
}

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
function both(group, geo, mat, name){
  const r = new THREE.Mesh(geo, mat), l = new THREE.Mesh(mirrorX(geo), mat);
  r.name = name + 'R'; l.name = name + 'L';
  group.add(r, l);
  return [r, l];
}
function tube(points, radius, mat, { closed = false, seg = 120, radial = 8 } = {}){
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, radial, closed), mat);
}

// ------------------------------------------------------------------ materials
function M(o){ return new THREE.MeshPhysicalMaterial(o); }
function materials(st, aniso){
  const gold = M({ color: '#c0913a', metalness: 1, roughness: 0.32, clearcoat: 0.2 });
  const grain = grainTexture(st.bowl.grain, aniso); grain.repeat.set(3, 2);
  const bowl = M({ color: '#ffffff', map: grain, metalness: st.bowl.metal, roughness: st.bowl.rough, clearcoat: st.bowl.metal < 0.4 ? 0.55 : 0.25, clearcoatRoughness: 0.35 });
  const rivet = M({ color: st.rivet.color, metalness: st.rivet.metal, roughness: st.rivet.rough });
  const lacquer = M({ color: st.visor, roughness: 0.45, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  const band = M({ color: st.band, roughness: 0.3, metalness: st.band === '#c49a46' ? 1 : 0.15, clearcoat: 0.8 });
  const cordMat = M({ color: '#c9a77a', roughness: 0.85 });
  const darkCord = M({ color: '#4a2c1a', roughness: 0.85 });
  return { gold, bowl, rivet, lacquer, band, cordMat, darkCord };
}
function lacingMat(spec, aniso, extra = {}){
  const { map, bump } = lamesTexture({ seed: 5, ...spec }, aniso);
  return M({ map, bumpMap: bump, bumpScale: 2.2, roughness: 0.55, metalness: 0.05, clearcoat: 0.45, clearcoatRoughness: 0.35, side: THREE.DoubleSide, ...extra });
}

// ------------------------------------------------------------------ the helmet bowl
// An ellipsoid dome over the skull, its rim lower at the back than over the brow.
const BOWL = { cy: 3.0, cz: -4.0, ax: 9.8, ay: 10.2, az: 11.2, yf: 6.0, yb: 2.6 };
function rimPhi(t){ const y = BOWL.yb + (BOWL.yf - BOWL.yb) * (1 + Math.cos(t)) / 2; return Math.acos((y - BOWL.cy) / BOWL.ay); }
function bowlPoint(t, s, k = 1){
  // t: angle round from the front (+z) toward +x; s: 0 at the top → 1 at the rim
  const ph = s * rimPhi(t);
  return [k * BOWL.ax * Math.sin(ph) * Math.sin(t), BOWL.cy + BOWL.ay * Math.cos(ph), BOWL.cz + k * BOWL.az * Math.sin(ph) * Math.cos(t)];
}

function bowl(st, mat){
  const g = new THREE.Group(); g.name = 'hachi';
  const N = st.plates;
  // overlapping plates: each one stands a little proud of the next (a sawtooth round the bowl)
  const step = (t, s) => 1 + 0.014 * (1 - ((t / TAU * N) % 1)) * smooth(0.05, 0.3, s);
  const geo = surface(N * 8, 48, (u, v) => { const t = u * TAU, s = 1 - v; return bowlPoint(t, s, step(t, s)); });
  g.add(new THREE.Mesh(geo, mat.bowl));
  // rivets (hoshi) along every plate edge, smaller toward the top
  const sph = new THREE.SphereGeometry(1, 10, 6);
  const count = N * 11;
  const inst = new THREE.InstancedMesh(sph, mat.rivet, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < N; i++){
    const t = (i + 0.06) / N * TAU;
    for (let k = 0; k < 11; k++){
      const s = 0.3 + k * 0.064;
      p.fromArray(bowlPoint(t, s, 1.012));
      const r = 0.12 + 0.14 * s * (st.plates < 30 ? 1.5 : 1);
      m4.compose(p, q, sc.set(r, r, r));
      inst.setMatrixAt(n++, m4);
    }
  }
  inst.count = n;
  g.add(inst);
  // the band round the rim (koshimaki)
  g.add(new THREE.Mesh(surface(160, 3, (u, v) => bowlPoint(u * TAU, 1 - 0.08 * v, 1.03)), mat.band));
  // the gilt ring round the hole at the top (tehen no kanamono)
  const top = BOWL.cy + BOWL.ay;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.32, 10, 36), mat.gold);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, top - 0.05, BOWL.cz);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.18, 8, 40), mat.gold);
  ring2.rotation.x = Math.PI / 2; ring2.position.set(0, top - 0.25, BOWL.cz);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), M({ color: '#050302', roughness: 1 }));
  hole.rotation.x = -Math.PI / 2; hole.position.set(0, top + 0.02, BOWL.cz);
  g.add(ring, ring2, hole);
  return g;
}

// The visor (mabizashi) juts forward and down from the front of the rim, with a gilt edge.
function visor(mat){
  const g = new THREE.Group(); g.name = 'mabizashi';
  const A = 1.3;
  const f = (u, v) => {
    const t = (u - 0.5) * 2 * A;
    const p = bowlPoint(t, 1, 1.02);
    const L = 3.1 * Math.cos(t * 0.95) ** 0.7 * smooth(A, A * 0.55, Math.abs(t));
    const d = [Math.sin(t), 0, Math.cos(t)];
    return [p[0] + d[0] * L * v, p[1] - 1.3 * L / 3.1 * v + 0.35 * v * v, p[2] + d[2] * L * v];
  };
  g.add(new THREE.Mesh(surface(80, 8, f), mat.lacquer));
  const edge = [];
  for (let i = 0; i <= 60; i++){ const p = f(i / 60, 1); edge.push(V(...p)); }
  g.add(tube(edge, 0.13, mat.gold, { seg: 160 }));
  return g;
}

// ------------------------------------------------------------------ neck guard (shikoro)
// Laced lames hung round the back and sides of the bowl, flaring like a bell. Each upper
// lame laps over the one below, like roof tiles.
function shikoro(st, mat, aniso){
  const S = st.shikoro, g = new THREE.Group(); g.name = 'shikoro';
  const R = (y) => S.r0 + (S.r1 - S.r0) * ((S.y0 - y) / (S.y0 - S.y1)) ** 1.25;
  const lh = (S.y0 - S.y1) / S.lames, over = 0.55;
  const arc = (r) => r * (TAU - 2 * S.a0);
  const matL = lacingMat({ ...st.lacing, lames: 1, cols: Math.round(arc((S.r0 + S.r1) / 2) / 1.0) }, aniso);
  const matLast = lacingMat({ ...st.lacing, lames: 1, cols: Math.round(arc((S.r0 + S.r1) / 2) / 1.0), knots: st.lacing.knots }, aniso);
  for (let L = 0; L < S.lames; L++){
    const yT = S.y0 - L * lh + (L ? over : 0), yB = S.y0 - (L + 1) * lh;
    const off = 0.32 * (S.lames - L);
    // the front ends sweep back a little lower down, so the face stays open
    const a0 = S.a0 + 0.06 * L;
    const f = (u, v) => {
      const t = a0 + u * (TAU - 2 * a0), y = yB + (yT - yB) * v;
      const r = R(y) + off + 0.45 * (1 - v);
      return [r * Math.sin(t), y, BOWL.cz + 0.2 + r * S.ez * Math.cos(t)];
    };
    const m = new THREE.Mesh(surface(120, 6, f), L === S.lames - 1 ? matLast : matL);
    m.renderOrder = 1;
    g.add(m);
    // a lacquered rolled edge along the top of the first lame
    if (L === 0){
      const e = []; for (let i = 0; i <= 80; i++) e.push(V(...f(i / 80, 1)));
      g.add(tube(e, 0.22, mat.lacquer, { seg: 160 }));
    }
  }
  return { g, R, S };
}

// ------------------------------------------------------------------ flaps (fukigaeshi)
function flaps(st, mat, aniso, crestTex){
  const g = new THREE.Group(); g.name = 'fukigaeshi';
  const big = st.flap.kind === 'leather';
  const W = big ? 7.2 : 6.4, Hb = big ? -3.6 : -3.0, Ht = big ? 5.4 : 4.6;
  const sh = new THREE.Shape();
  sh.moveTo(0, -2.6); sh.lineTo(W * 0.8, Hb);
  sh.quadraticCurveTo(W + 0.2, Hb + 0.2, W, 0);
  sh.lineTo(W * 0.96, Ht - 1.2);
  sh.quadraticCurveTo(W * 0.92, Ht + 0.2, W * 0.7, Ht);
  sh.lineTo(0, 3.1); sh.lineTo(0, -2.6);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 10 });
  // UVs from the flat shape, then place it: out and back from the front of the neck guard
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (W + 0.4), (p.getY(i) + 4) / 9.6);
  const u = V(0.82, 0, -0.57).normalize(), v = V(0, 1, 0), n = new THREE.Vector3().crossVectors(u, v);
  const basis = new THREE.Matrix4().makeBasis(u, v, n).setPosition(9.3, 3.9, 1.6);
  // a gentle curl, like leather over a plate
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - 0.035 * p.getX(i) ** 2);
  geo.applyMatrix4(basis);
  geo.computeVertexNormals();
  let face;
  if (big){
    const lt = leatherTexture(st.lacing.pal, aniso, 21); lt.repeat.set(1.6, 1.6);
    face = M({ map: lt, roughness: 0.75, clearcoat: 0.1, side: THREE.DoubleSide });
  } else face = M({ color: st.flap.color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
  both(g, geo, face, 'flap');
  // gilt rim (fukurin) round the edge
  const edge = sh.getPoints(24).map((q) => V(q.x, q.y, 0.47 - 0.035 * q.x ** 2).applyMatrix4(basis));
  const rim = tube(edge, 0.14, mat.gold, { closed: true, seg: 200 });
  g.add(rim); const rimL = rim.clone(); rimL.geometry = mirrorX(rim.geometry); g.add(rimL);
  // a crest disc, or three gilt rosettes on the leather
  const spots = st.crestDisc ? [[W * 0.52, 0.7, 1.55]] : [[W * 0.78, 3.6, 0.42], [W * 0.5, -1.9, 0.42], [W * 0.82, -2.3, 0.42]];
  for (const [x, y, r] of spots){
    const disc = new THREE.CylinderGeometry(r, r * 1.03, 0.22, 40);
    disc.rotateX(Math.PI / 2);
    disc.translate(x, y, 0.55 - 0.035 * x * x);
    disc.applyMatrix4(basis);
    const mats = st.crestDisc ? [mat.gold, M({ map: crestTex, metalness: 1, roughness: 0.3 }), mat.gold] : mat.gold;
    both(g, disc, mats, 'mon');
  }
  return g;
}

// ------------------------------------------------------------------ golden horns (kuwagata)
function horns(mat){
  const g = new THREE.Group(); g.name = 'kuwagata';
  const zAt = (y) => { const c = (y - BOWL.cy) / BOWL.ay; return BOWL.cz + BOWL.az * Math.sqrt(1 - c * c); };
  // the base plate (kuwagata-dai): a gilt shield on the bowl front, with rivets
  const dai = new THREE.Shape();
  dai.moveTo(-2.6, 0); dai.quadraticCurveTo(-2.9, 2.4, -1.6, 3.4); dai.quadraticCurveTo(0, 4.4, 1.6, 3.4); dai.quadraticCurveTo(2.9, 2.4, 2.6, 0);
  dai.quadraticCurveTo(0, -0.7, -2.6, 0);
  const dg = new THREE.ExtrudeGeometry(dai, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 });
  dg.rotateX(-0.62); dg.translate(0, 6.7, zAt(7.6) + 0.05);
  g.add(new THREE.Mesh(dg, mat.gold));
  for (const [x, y] of [[-1.9, 0.6], [1.9, 0.6], [0, 3.4]]){
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 6), mat.gold);
    r.position.set(x, 6.7 + y * 0.82, zAt(7.6) + 0.5 - y * 0.58); g.add(r);
  }
  // one blade: a broad gilt sweep, widening upward to a rounded spade tip
  const N = 40, left = [], right = [];
  for (let i = 0; i <= N; i++){
    const t = i / N;
    const cx = 0.3 + 9.5 * t ** 1.6, cy = 16 * t;
    const dx = 9.5 * 1.6 * t ** 0.6 + 1e-3, dy = 16, l = Math.hypot(dx, dy);
    const w = 0.55 + 1.6 * t ** 1.1 + 0.3 * Math.sin(Math.PI * t);
    left.push([cx - dy / l * w, cy + dx / l * w]); right.push([cx + dy / l * w, cy - dx / l * w]);
  }
  const bl = new THREE.Shape();
  bl.moveTo(...left[0]);
  for (const q of left) bl.lineTo(...q);
  const tl = left[N], tr = right[N];
  bl.bezierCurveTo(tl[0] + 0.4, tl[1] + 2.4, tr[0] + 1.8, tr[1] + 1.6, tr[0], tr[1]);
  for (let i = N; i >= 0; i--) bl.lineTo(...right[i]);
  bl.lineTo(...left[0]);
  const hg = new THREE.ExtrudeGeometry(bl, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, curveSegments: 12 });
  hg.rotateY(-0.12); hg.rotateX(-0.3);
  hg.translate(0.55, 8.4, zAt(8.4) + 1.1);
  both(g, hg, mat.gold, 'horn');
  // the sword-shaped crest between them (ken-maedate)
  const ken = new THREE.Shape();
  ken.moveTo(-0.55, 0); ken.lineTo(-0.5, 7.4); ken.lineTo(0, 9.4); ken.lineTo(0.5, 7.4); ken.lineTo(0.55, 0); ken.lineTo(-0.55, 0);
  const kg = new THREE.ExtrudeGeometry(ken, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  kg.rotateX(-0.28); kg.translate(0, 9.2, zAt(9.2) + 0.9);
  g.add(new THREE.Mesh(kg, mat.gold));
  return g;
}

// ------------------------------------------------------------------ face guard (menpō)
const MP = { x0: -7.3, x1: 7.3, y0: -10.6, y1: 3.4 };
const yTop = (x) => 0.75 + 2.35 * Math.exp(-((x / 1.25) ** 2)) + 0.9 * smooth(5, 7.3, Math.abs(x));
const yBot = (x) => -10.0 + 0.11 * x * x;
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));
function segDist(x, y, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
// The carved surface and what is painted where.
function menpoAt(x, y){
  const ax = Math.abs(x);
  let z = faceShell(x, y) + 0.6;
  // a nose of iron over the real nose, hooked at the tip, with flared nostrils
  const nm = Math.exp(-((x / 1.7) ** 2)) * smooth(-2.4, -1.2, y) * (1 - smooth(2.4, 3.6, y));
  z = Math.max(z, (faceZ(x, y) + 0.55) * nm + z * (1 - nm));
  z += 0.45 * gauss(x, y, 0, -0.5, 0.75, 0.9) + 0.3 * gauss(ax, y, 1.35, -1.25, 0.55, 0.45);
  // cheekbones and the deep folds from the nose down to the mouth
  z += 0.4 * gauss(ax, y, 3.9, 0.1, 1.5, 1.2);
  z += 0.32 * Math.exp(-((segDist(ax, y, 1.9, -1.4, 3.5, -4.8) / 0.28) ** 2));
  z += 0.22 * Math.exp(-((segDist(ax, y, 2.9, -0.8, 4.6, -4.2) / 0.25) ** 2));
  z += 0.18 * Math.exp(-((segDist(ax, y, 3.6, -0.4, 5.6, -3.4) / 0.22) ** 2));
  // moustache: two raised sweeps above the lip
  const must = Math.exp(-((segDist(ax, y, 0.35, -3.05, 2.9, -3.75) / 0.32) ** 2)) * (ax > 0.15 ? 1 : 0.4);
  z += 0.22 * must;
  // chin
  z += 0.35 * gauss(x, y, 0, -8.3, 2.2, 1.2);
  // the mouth: raised lips round a recessed opening with a row of teeth
  const e = (x / 2.65) ** 2 + ((y + 4.45) / 1.0) ** 2;
  const lips = smooth(1.15, 0.85, e) * smooth(0.3, 0.5, e);
  const open = smooth(0.42, 0.3, e);
  z += 0.42 * lips - 1.0 * open;
  const teeth = open * (y > -4.45 ? 1 : 0);
  if (teeth > 0) z += 0.55 * teeth;
  return { z, lips, open, teeth, must };
}

function menpo(st, mat, aniso){
  const g = new THREE.Group(); g.name = 'menpo';
  const NX = 130, NY = 96;
  const f = (u, v) => {
    const x = MP.x0 + (MP.x1 - MP.x0) * u;
    const y = yBot(x) + (yTop(x) - yBot(x)) * v;
    return [x, y, menpoAt(x, y).z];
  };
  const geo = surface(NX, NY, f);
  // planar UVs so the painting lines up with the carving
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - MP.x0) / (MP.x1 - MP.x0), (p.getY(i) - MP.y0) / (MP.y1 - MP.y0));
  const map = paintMenpo(st.menpo, aniso);
  const face = M({ map, metalness: 0.45, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(geo, face));
  // a rolled iron edge all round
  const edge = [];
  for (let i = 0; i <= 60; i++) edge.push(V(...f(i / 60, 1)));
  for (let j = 59; j >= 1; j--) edge.push(V(...f(1, j / 60)));
  for (let i = 60; i >= 0; i--) edge.push(V(...f(i / 60, 0)));
  for (let j = 1; j <= 59; j++) edge.push(V(...f(0, j / 60)));
  const rimMat = M({ color: `rgb(${st.menpo.iron.map((c) => c * 0.7 | 0)})`, metalness: 0.5, roughness: 0.45 });
  g.add(tube(edge, 0.16, rimMat, { closed: true, seg: 400 }));
  return g;
}

function paintMenpo(P, aniso){
  const W = 640, H = Math.round(W * (MP.y1 - MP.y0) / (MP.x1 - MP.x0));
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H), d = img.data;
  const r = rng(9);
  const noise = new Float32Array(64 * 64).map(() => r());
  const nz = (x, y) => { const i = ((x * 4) & 63) + ((y * 4) & 63) * 64; return noise[i]; };
  for (let j = 0; j < H; j++){
    const y = MP.y1 - (j + 0.5) / H * (MP.y1 - MP.y0);
    for (let i = 0; i < W; i++){
      const x = MP.x0 + (i + 0.5) / W * (MP.x1 - MP.x0);
      const A = menpoAt(x, y);
      // relief light: compare with the surroundings (cavities dark, ridges light)
      const h = 0.3;
      const avg = (menpoAt(x + h, y).z + menpoAt(x - h, y).z + menpoAt(x, y + h).z + menpoAt(x, y - h).z) / 4;
      const cav = Math.max(-1, Math.min(1, (A.z - avg) * 6));
      const n = nz(x * 3, y * 3) * 0.6 + nz(x * 11, y * 11) * 0.4;
      const rust = Math.max(0, n - 0.6) * 2;
      let R = P.iron[0] * (0.85 + 0.3 * n) + (P.rust[0] - P.iron[0]) * rust;
      let G = P.iron[1] * (0.85 + 0.3 * n) + (P.rust[1] - P.iron[1]) * rust;
      let B = P.iron[2] * (0.85 + 0.3 * n) + (P.rust[2] - P.iron[2]) * rust;
      const k = 1 + cav * 0.55;
      R *= k; G *= k; B *= k;
      // moustache hair: dark strands
      if (A.must > 0.25){ const s = 0.5 + 0.5 * Math.sin((x * 9 + y * 6) * 3); const m = Math.min(1, (A.must - 0.25) * 2) * (0.6 + 0.4 * s); R += (30 - R) * m; G += (22 - G) * m; B += (18 - B) * m; }
      // red lacquered lips
      if (A.lips > 0.01){ const m = Math.min(1, A.lips * 1.4); R += (176 - R) * m; G += (34 - G) * m; B += (26 - B) * m; }
      if (A.open > 0.01){
        let tr = 46, tg = 12, tb = 8;
        if (A.teeth > 0.5){
          const gap = Math.abs(((x + 10) / 0.42) % 1 - 0.5) < 0.06 || y < -4.15;
          if (!gap){ tr = 228; tg = 216; tb = 192; } else { tr = 90; tg = 60; tb = 46; }
        }
        const m = Math.min(1, A.open * 1.6); R += (tr - R) * m; G += (tg - G) * m; B += (tb - B) * m;
      }
      const o = (j * W + i) * 4;
      d[o] = Math.max(0, Math.min(255, R)); d[o + 1] = Math.max(0, Math.min(255, G)); d[o + 2] = Math.max(0, Math.min(255, B)); d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c, { aniso });
}

// The throat guard (yodare-kake): laced lames under the menpō, beads along the top, a cord.
function yodare(st, mat, aniso){
  const g = new THREE.Group(); g.name = 'yodare-kake';
  const lm = lacingMat({ ...st.lacing, lames: 1, cols: 24 }, aniso);
  const cz = -2.6;
  for (let L = 0; L < 3; L++){
    const yT = -9.2 - L * 2.0, yB = yT - 2.5, r0 = 8.4 + L * 0.95, A = 1.25 + L * 0.07;
    const f = (u, v) => { const t = (u - 0.5) * 2 * A, y = yB + (yT - yB) * v, r = r0 + 1.1 * (1 - v) + 0.25 * (2 - L); return [r * Math.sin(t), y, cz + r * Math.cos(t)]; };
    g.add(new THREE.Mesh(surface(60, 4, f), lm));
    if (L === 0){
      const sph = new THREE.SphereGeometry(1, 10, 8);
      const bead = new THREE.InstancedMesh(sph, M({ color: '#efe3c4', roughness: 0.5, clearcoat: 0.6 }), 40);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(0.36, 0.32, 0.36);
      for (let i = 0; i < 40; i++){ const p = f((i + 0.5) / 40, 1); m4.compose(V(p[0], p[1] + 0.15, p[2] + 0.1 * Math.cos((i / 40 - 0.5) * 2 * A)), q, s); bead.setMatrixAt(i, m4); }
      g.add(bead);
    }
  }
  // the tied cord under the chin (reference 1's tan rope)
  const pts = [];
  for (let i = 0; i <= 24; i++){ const t = (i / 24 - 0.5) * 2.4; pts.push(V(7.6 * Math.sin(t), -8.7 - 0.3 * Math.cos(t * 2), cz + 7.6 * Math.cos(t) + 0.4)); }
  g.add(tube(pts, 0.45, mat.cordMat, { seg: 120, radial: 10 }));
  return g;
}

// The chin cord (shinobi-no-o) that ties the helmet on when there is no face guard.
function chinCord(mat){
  const pts = [V(-9.2, 3.2, 0.2), V(-8.2, -2.5, 1.2), V(-6.4, -6.6, 2.6), V(-3.4, -9.6, 3.9), V(0, -10.55, 4.25), V(3.4, -9.6, 3.9), V(6.4, -6.6, 2.6), V(8.2, -2.5, 1.2), V(9.2, 3.2, 0.2)];
  const g = new THREE.Group(); g.name = 'shinobi-no-o';
  g.add(tube(pts, 0.32, M({ color: '#7c2318', roughness: 0.8 }), { seg: 120, radial: 8 }));
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.22, 48, 8, 2, 3), M({ color: '#7c2318', roughness: 0.8 }));
  knot.position.set(0, -10.7, 4.3); g.add(knot);
  return g;
}

// ------------------------------------------------------------------ torso
// Local to the neck pivot; y down the body, +z forward.
function torso(st, mat, aniso, kind){
  const g = new THREE.Group(); g.name = 'torso';
  // the cuirass (dō): a broad curved front made of laced lames
  const cz = -4.2, rx = 16.5, rz = 10.6, A = 1.4, lames = 7, yT0 = -7.2, yB = -40;
  const top = (t) => yT0 - 7 * smooth(0.6, 1.25, Math.abs(t));
  const lh = (yT0 - yB) / lames;
  const leather = kind === 'oyoroi' ? { u0: 0.36, u1: 0.64, v0: 0.32, v1: 0.88 } : null;
  const dm = lacingMat({ ...st.doLacing, lames, cols: 52, leather }, aniso);
  const fdo = (u, v) => {
    const t = (u - 0.5) * 2 * A, yTop = top(t), y = yB + (yTop - yB) * v;
    const step = 0.35 * (((yT0 - y) / lh) % 1);
    const barrel = 1 + 0.05 * Math.sin(Math.PI * (yT0 - y) / (yT0 - yB));
    return [rx * barrel * Math.sin(t) * (1 + step / rx), y, cz + (rz * barrel + step) * Math.cos(t)];
  };
  g.add(new THREE.Mesh(surface(90, 70, fdo), dm));
  // a gilt edge along the top of the breastplate
  const e = []; for (let i = 0; i <= 60; i++) e.push(V(...fdo(i / 60, 1)).add(V(0, 0, 0.12)));
  g.add(tube(e, 0.26, kind === 'oyoroi' ? mat.gold : mat.lacquer, { seg: 160 }));
  if (st.ring){
    // the gilt ring on the chest (agemaki-no-kan) with a tied cord
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.22, 10, 30), mat.gold);
    const p = fdo(0.5, 0.92); ring.position.set(p[0], p[1] - 0.8, p[2] + 0.35); g.add(ring);
  }
  // shoulder straps (watagami) over to the back
  for (const s of [-1, 1]){
    const pts = [V(s * 8.2, top(0.52) + 0.1, cz + rz * Math.cos(0.52) - 0.3), V(s * 9.4, -6.3, -0.5), V(s * 9.8, -6.6, -7.5)];
    const strap = tube(pts, 0.9, mat.lacquer, { seg: 30, radial: 10 });
    strap.scale.set(1, 1, 1); g.add(strap);
  }
  // shoulder guards (sode): big laced panels hanging over the upper arms
  const big = kind === 'oyoroi';
  const sm = lacingMat({ ...st.sodeLacing, lames: big ? 7 : 6, cols: 16 }, aniso);
  const ax = 17.6, az = -4.5, ar = big ? 7.4 : 6.8, sy0 = -5.8, sy1 = big ? -31 : -27;
  const fs = (u, v) => {
    const t = 0.1 + u * (big ? 1.95 : 1.8), y = sy1 + (sy0 - sy1) * v;
    const flare = 1 + 0.12 * (1 - v);
    return [ax + ar * flare * Math.sin(t) * 0.9, y, az + ar * flare * Math.cos(t)];
  };
  both(g, surface(40, 40, fs), sm, 'sode');
  // the lacquered top plate of each sode (kanmuri-ita) with a gilt edge
  const kf = (u, v) => { const p = fs(u, 1); return [p[0] + 0.25 * v, p[1] + 1.4 * v, p[2] + 0.4 * v * Math.cos(0.1 + u * 1.9)]; };
  both(g, surface(40, 3, kf), mat.lacquer, 'kanmuri');
  const ke = []; for (let i = 0; i <= 40; i++) ke.push(V(...kf(i / 40, 1)));
  const ktube = tube(ke, 0.18, mat.gold, { seg: 80 });
  g.add(ktube); const kl = ktube.clone(); kl.geometry = mirrorX(ktube.geometry); g.add(kl);
  // the skirt (kusazuri): five laced panels below the waist
  const km = lacingMat({ ...st.doLacing, lames: 4, cols: 12, leather: null, clouds: false }, aniso);
  for (let i = 0; i < 5; i++){
    const t0 = -A * 0.95 + i * (A * 1.9 / 5) + 0.03, t1 = t0 + A * 1.9 / 5 - 0.06;
    const f = (u, v) => { const t = t0 + (t1 - t0) * u, y = -56 + 16.5 * v, r = 1 + 0.12 * (1 - v); return [rx * r * Math.sin(t), y, cz + rz * r * Math.cos(t) + 0.3]; };
    g.add(new THREE.Mesh(surface(16, 12, f), km));
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
  head.scale.set(7.4, 10.2, 8.6); head.position.set(0, 2.0, -4.5);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.4, 22, 32), mat);
  neck.scale.set(1, 1, 0.95); neck.position.set(0, -16, -3.6);
  for (const m of [head, neck]) m.renderOrder = -1;
  g.add(head, neck);
  return g;
}

// ------------------------------------------------------------------ the whole suit
export function buildSuit(id, { aniso = 8, menpo: withMenpo } = {}){
  const t0 = performance.now();
  const st = STYLES[id];
  const mat = materials(st, aniso);
  const crestTex = crestTexture(aniso);
  const root = new THREE.Group(); root.name = id;
  const head = new THREE.Group(); head.name = 'head';
  head.add(bowl(st, mat), visor(mat), shikoro(st, mat, aniso).g, flaps(st, mat, aniso, crestTex));
  if (st.horns) head.add(horns(mat));
  const face = new THREE.Group(); face.name = 'faceguard';
  face.add(menpo(st, mat, aniso));
  const lower = new THREE.Group(); lower.name = 'lower';
  lower.add(yodare(st, mat, aniso));
  const cord = chinCord(mat);
  head.add(lower, cord);
  root.add(head, face);
  const body = torso(st, mat, aniso, id);
  root.userData = { head, face, lower, cord, body, buildMs: 0 };
  setMenpo(root, withMenpo ?? true);
  root.userData.buildMs = Math.round(performance.now() - t0);
  return root;
}

// Face guard on: menpō + throat guard; off: the chin cord ties the helmet on.
export function setMenpo(root, on){
  const u = root.userData;
  u.face.visible = on; u.lower.visible = on; u.cord.visible = !on;
}

export function disposeSuit(root){
  const seen = new Set();
  const all = [root, root.userData.body].filter(Boolean);
  for (const r of all) r.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)){ seen.add(o.geometry); o.geometry.dispose(); }
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms){
      if (seen.has(m)) continue; seen.add(m);
      for (const k of ['map', 'bumpMap']) if (m[k] && !seen.has(m[k])){ seen.add(m[k]); m[k].dispose(); }
      m.dispose();
    }
  });
}
