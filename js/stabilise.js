// Keeping the helmet steady, the way head-wear lenses do.
//
// The face tracker's pose shakes a little on every frame (camera noise, the landmarks
// re-fitting). A helmet magnifies it: the crown and the horn tips are 15–25 cm from the
// middle of the face, so a wobble of a fraction of a degree there becomes a visible shimmer.
//
// A One Euro filter (Casiez, Roussel & Vogel, CHI 2012) fixes that: when the head is still it
// smooths heavily (a low cut-off), and as the head moves faster the cut-off rises so the helmet
// keeps up without lag. Position across the picture, depth (the noisiest, since one camera
// guesses distance from face size) and rotation each get their own filter. Times are seconds.

import * as THREE from 'three';

const alpha = (dt, cutoff) => { const r = 2 * Math.PI * cutoff * dt; return r / (r + 1); };

// One scalar speed, smoothed, drives the cut-off for a whole vector or rotation.
class Speed {
  constructor(dCut){ this.dCut = dCut; this.v = 0; }
  update(raw, dt){ this.v += (raw - this.v) * alpha(dt, this.dCut); return this.v; }
}

export class PoseFilter {
  constructor({
    lateral = { min: 0.9, beta: 0.6 },    // Hz, Hz per cm/s
    depth = { min: 0.45, beta: 0.15 },    // Hz, Hz per cm/s
    rotation = { min: 0.9, beta: 3.0 },   // Hz, Hz per rad/s
    dCut = 1.2,
  } = {}){
    Object.assign(this, { lateral, depth, rotation });
    this.p = new THREE.Vector3(); this.q = new THREE.Quaternion();
    this.rawP = new THREE.Vector3(); this.rawQ = new THREE.Quaternion();
    this.sLat = new Speed(dCut); this.sDep = new Speed(dCut); this.sRot = new Speed(dCut);
    this.t = null;
  }
  reset(){ this.t = null; }
  // p, q: the new measured pose; t: its time in seconds. Returns the filtered pose (this.p, this.q).
  filter(t, p, q){
    if (this.t === null || t - this.t > 0.5){
      this.p.copy(p); this.q.copy(q); this.rawP.copy(p); this.rawQ.copy(q); this.t = t;
      this.sLat.v = this.sDep.v = this.sRot.v = 0;
      return this;
    }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    // how fast the raw pose is moving
    const vLat = Math.hypot(p.x - this.rawP.x, p.y - this.rawP.y) / dt;
    const vDep = Math.abs(p.z - this.rawP.z) / dt;
    const vRot = this.rawQ.angleTo(q) / dt;
    this.rawP.copy(p); this.rawQ.copy(q);
    const aLat = alpha(dt, this.lateral.min + this.lateral.beta * this.sLat.update(vLat, dt));
    const aDep = alpha(dt, this.depth.min + this.depth.beta * this.sDep.update(vDep, dt));
    const aRot = alpha(dt, this.rotation.min + this.rotation.beta * this.sRot.update(vRot, dt));
    this.p.x += (p.x - this.p.x) * aLat;
    this.p.y += (p.y - this.p.y) * aLat;
    this.p.z += (p.z - this.p.z) * aDep;
    this.q.slerp(q, aRot);
    return this;
  }
}

// The face guard follows the live landmarks; smooth them too so its edges don't shimmer.
export class LandmarkFilter {
  constructor(cutoff = 3){ this.cutoff = cutoff; this.v = null; this.t = null; }
  reset(){ this.v = null; }
  filter(t, lms){
    if (!this.v || this.t === null || t - this.t > 0.5){ this.v = lms.map((p) => [p[0], p[1], p[2]]); this.t = t; return this.v; }
    const a = alpha(Math.max(1e-3, t - this.t), this.cutoff);
    this.t = t;
    for (let i = 0; i < lms.length; i++){ const o = this.v[i], p = lms[i]; o[0] += (p[0] - o[0]) * a; o[1] += (p[1] - o[1]) * a; o[2] += (p[2] - o[2]) * a; }
    return this.v;
  }
}
