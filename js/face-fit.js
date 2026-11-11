// Making a mask hug the face the way a Snapchat lens does.
//
// 1. Fit: the shell every mask is carved from follows the real face surface (MindAR's
//    canonical face, smoothed so it bridges the eye sockets and the nose) a few
//    millimetres in front of it, instead of a generic egg.
// 2. Follow: every vertex of a built mask is tied to its nearest face landmarks. Each
//    frame the landmarks' live positions (your face's own shape, jaw, cheeks) move the
//    vertices with them, so the mask stretches with your face. A carved mask has a
//    fixed mouth, so the lips and jaw are left out: talking or opening your mouth does
//    not open the mask.

import { positions as LM, faces } from './face-model.js';

// ------------------------------------------------------------------ 1 · the face surface
const SPAN = 30, N = 240, CELL = SPAN / N; // a depth map of the face over x, y in [-15, 15] cm
function rasterise(){
  const z = new Float32Array(N * N).fill(-Infinity);
  const toG = (v) => (v + SPAN / 2) / CELL - 0.5;
  for (let f = 0; f < faces.length; f += 3){
    const A = LM[faces[f]], B = LM[faces[f + 1]], C = LM[faces[f + 2]];
    const ax = toG(A[0]), ay = toG(A[1]), bx = toG(B[0]), by = toG(B[1]), cx = toG(C[0]), cy = toG(C[1]);
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++){
      const l1 = ((by - cy) * (i - cx) + (cx - bx) * (j - cy)) / d, l2 = ((cy - ay) * (i - cx) + (ax - cx) * (j - cy)) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const zz = l1 * A[2] + l2 * B[2] + l3 * C[2];
      if (zz > z[j * N + i]) z[j * N + i] = zz;
    }
  }
  // beyond the face (hairline, under the chin, past the cheeks) continue the surface outward
  const known = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) known[k] = z[k] > -Infinity ? 1 : 0;
  const face = Float32Array.from(known);
  for (let pass = 0; pass < N; pass++){
    let changed = 0;
    const next = z.slice(), nk = known.slice();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
      const k = j * N + i;
      if (known[k]) continue;
      let s = 0, n = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
        const kk = jj * N + ii;
        if (known[kk]){ s += z[kk]; n++; }
      }
      // fall away gently as we leave the face, like the sides of a head
      if (n){ next[k] = s / n - 0.06; nk[k] = 1; changed++; }
    }
    z.set(next); known.set(nk);
    if (!changed) break;
  }
  return { z, face };
}
function blur(src, r){
  let a = Float32Array.from(src), b = new Float32Array(N * N);
  for (let pass = 0; pass < 3; pass++){
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
      let s = 0; for (let d = -r; d <= r; d++) s += a[j * N + Math.min(N - 1, Math.max(0, i + d))];
      b[j * N + i] = s / (2 * r + 1);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
      let s = 0; for (let d = -r; d <= r; d++) s += b[Math.min(N - 1, Math.max(0, j + d)) * N + i];
      a[j * N + i] = s / (2 * r + 1);
    }
  }
  return a;
}
// The fill steps out cell by cell, which leaves faint diamond-shaped terraces; off the
// face (the head above a tall mask, the sides) a heavy blur takes them out.
const RAW = (() => {
  const { z, face } = rasterise();
  const B = blur(z, 16), w = blur(face, 4);
  for (let k = 0; k < N * N; k++){ const t = Math.min(1, 2 * w[k]); z[k] = z[k] * t + B[k] * (1 - t); }
  return z;
})();
// Smoothed by about 1.5 cm: the shell bridges the eyes and the nose (the carving adds
// its own nose), but follows the forehead, cheeks, jaw and chin.
const SMOOTH = blur(RAW, 6), FLAT = blur(RAW, 16);
function sample(arr, x, y){
  const u = Math.min(N - 1.001, Math.max(0, (x + SPAN / 2) / CELL - 0.5)), v = Math.min(N - 1.001, Math.max(0, (y + SPAN / 2) / CELL - 0.5));
  const i = u | 0, j = v | 0, fx = u - i, fy = v - j, k = j * N + i;
  return (arr[k] * (1 - fx) + arr[k + 1] * fx) * (1 - fy) + (arr[k + N] * (1 - fx) + arr[k + N + 1] * fx) * fy;
}
export const faceZ = (x, y) => sample(RAW, x, y);
export const faceShell = (x, y) => sample(SMOOTH, x, y);
// The shell masks are carved from: 3.5 mm in front of the smoothed face. Over the nose it
// uses a much flatter version, because each mask carves its own nose on top.
export const GAP = 0.35;
export function shellZ(x, y){
  const wn = Math.exp(-(x * x) / (2 * 1.4 * 1.4) - ((y - 0.6) ** 2) / (2 * 2.6 * 2.6));
  return sample(SMOOTH, x, y) * (1 - wn) + sample(FLAT, x, y) * wn + GAP;
}

// ------------------------------------------------------------------ 2 · following the face
// Eyelid landmarks are left out: a blink should not squeeze the mask.
const EYELIDS = new Set([33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
  130, 25, 110, 24, 23, 22, 26, 112, 243, 190, 56, 28, 27, 29, 30, 247,
  359, 255, 339, 254, 253, 252, 256, 341, 463, 414, 286, 258, 257, 259, 260, 467]);
// Lips and jaw are left out too: everything below the base of the nose. The lower part
// of the mask then follows the nose and cheeks, which stay put when the mouth opens.
const JAW_Y = -2.2;
const USE = LM.map((_, i) => i).filter((i) => !EYELIDS.has(i) && LM[i][1] > JAW_Y);
const K = 6, SIGMA = 1.1;

// Ties every vertex of every mesh in the mask to its K nearest landmarks.
export function bindToFace(group){
  if (group.userData.skin) return;
  // bake every part's placement (ears inside an ear group, teeth, horns) into its own
  // geometry, so all vertices live in mask space before they are tied to the face
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push([o, inv.clone().multiply(o.matrixWorld)]); });
  for (const [o, m] of meshes){ o.geometry = o.geometry.clone(); o.geometry.applyMatrix4(m); }
  group.traverse((o) => { if (o !== group){ o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); } });
  const binds = [];
  for (const [o] of meshes){
    const pos = o.geometry.attributes.position, n = pos.count;
    const base = Float32Array.from(pos.array);
    const idx = new Uint16Array(n * K), w = new Float32Array(n * K);
    const bi = new Int32Array(K), bd = new Float32Array(K);
    for (let v = 0; v < n; v++){
      const x = base[v * 3], y = base[v * 3 + 1], z = base[v * 3 + 2];
      bd.fill(Infinity);
      for (const l of USE){
        const L = LM[l], d = (L[0] - x) ** 2 + (L[1] - y) ** 2 + (L[2] - z) ** 2;
        if (d >= bd[K - 1]) continue;
        let k = K - 1;
        while (k > 0 && bd[k - 1] > d){ bd[k] = bd[k - 1]; bi[k] = bi[k - 1]; k--; }
        bd[k] = d; bi[k] = l;
      }
      let s = 0;
      for (let k = 0; k < K; k++){ const ww = Math.exp(-(bd[k] - bd[0]) / (2 * SIGMA * SIGMA)); w[v * K + k] = ww; s += ww; idx[v * K + k] = bi[k]; }
      for (let k = 0; k < K; k++) w[v * K + k] /= s;
    }
    pos.setUsage(35048); // DYNAMIC_DRAW
    binds.push({ pos, base, idx, w, n });
  }
  group.userData.skin = binds;
}

// Moves the mask with the live landmarks (MindAR's metricLandmarks, in the same cm space).
const delta = new Float32Array(LM.length * 3);
export function followFace(group, live){
  const binds = group.userData.skin;
  if (!binds || !live) return;
  for (let l = 0; l < LM.length; l++){
    const p = live[l];
    delta[l * 3] = p[0] - LM[l][0]; delta[l * 3 + 1] = p[1] - LM[l][1]; delta[l * 3 + 2] = p[2] - LM[l][2];
  }
  for (const b of binds){
    const a = b.pos.array, base = b.base, idx = b.idx, w = b.w;
    for (let v = 0, o = 0; v < b.n; v++, o += 3){
      let dx = 0, dy = 0, dz = 0;
      for (let k = 0, q = v * K; k < K; k++, q++){
        const l = idx[q] * 3, ww = w[q];
        dx += delta[l] * ww; dy += delta[l + 1] * ww; dz += delta[l + 2] * ww;
      }
      a[o] = base[o] + dx; a[o + 1] = base[o + 1] + dy; a[o + 2] = base[o + 2] + dz;
    }
    b.pos.needsUpdate = true;
  }
}
