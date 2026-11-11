// The dressing stage: MindAR face tracking with the front camera, the helmet fixed to the
// face, the armour hanging from the neck, and photos. Without a camera (or with
// ?preview=1) the suit stands on a wooden head-form you can turn with a finger.
//
// The helmet is built in MindAR's canonical face units (cm) and hangs from the whole-face
// pose (faceMatrix). The iron face guard is also skinned to the live landmarks, like a
// lens, so it fits each face. The cuirass follows the neck but turns only a little with
// the head, the way a body does.

import * as THREE from 'three';
import { buildSuit, disposeSuit, setMenpo, occluders } from './armour.js';
import { setupLook, roomLight } from './look.js';
import { BY_ID } from './data.js';
import { bindToFace, followFace } from './face-fit.js';

export const NECK = new THREE.Vector3(0, -8, -3.5); // where the body hangs from, in face space

const R = {
  mode: null, container: null, mindar: null, renderer: null, scene: null, camera: null,
  face: null, torso: null, current: null, currentId: null, cache: new Map(), look: null, light: null,
  video: null, hasFace: false, onFace: null, menpo: true, armour: true,
  drag: { yaw: 0, pitch: 0, active: false }, t: 0, last: 0, swap: null, building: false,
};

// ------------------------------------------------------------------ suits
function ensureSuit(id){
  if (R.cache.has(id)) return R.cache.get(id);
  const s = buildSuit(id, { aniso: Math.min(8, R.renderer.capabilities.getMaxAnisotropy()), menpo: R.menpo });
  if (R.mode === 'camera') bindToFace(s.userData.face); // tie the face guard to the landmarks
  R.cache.set(id, s);
  return s;
}

// Put a suit on: the old helmet lifts away, the new one drops onto the head.
export async function wear(id){
  if (id === R.currentId || R.building) return;
  R.building = true;
  await new Promise((ok) => setTimeout(ok, 60)); // let the UI show "lacing…"
  let s;
  try { s = ensureSuit(id); } finally { R.building = false; }
  const old = R.current;
  R.current = s; R.currentId = id;
  setMenpo(s, R.menpo);
  s.userData.body.visible = R.armour;
  s.position.y = 30; s.userData.body.position.y = -45;
  R.face.add(s); R.torso.add(s.userData.body);
  R.swap = { t: 0, old, neu: s };
}
export const currentId = () => R.currentId;
export const isBuilding = () => R.building;
export function setFaceGuard(on){ R.menpo = on; for (const s of R.cache.values()) setMenpo(s, on); }
export function setArmour(on){ R.armour = on; for (const s of R.cache.values()) s.userData.body.visible = on; }

const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
function animateSwap(dt){
  const S = R.swap;
  if (!S) return;
  S.t += dt;
  if (S.old){
    const k = Math.min(1, S.t / 0.3);
    S.old.position.y = 34 * k * k; S.old.userData.body.position.y = -50 * k * k;
    if (k >= 1){ R.face.remove(S.old); R.torso.remove(S.old.userData.body); S.old.position.y = 0; S.old.userData.body.position.y = 0; S.old = null; }
  }
  const k = Math.min(1, Math.max(0, (S.t - 0.15) / 0.55));
  const e = easeOutBack(k);
  S.neu.position.y = 30 * (1 - e); S.neu.userData.body.position.y = -45 * (1 - e);
  if (k >= 1 && !S.old){ S.neu.position.y = 0; S.neu.userData.body.position.y = 0; R.swap = null; }
}

// ------------------------------------------------------------------ render loop
function frame(now){
  const dt = Math.min(0.05, (now - (R.last || now)) / 1000);
  R.last = now; R.t += dt;
  if (R.mode === 'camera') readFace(dt);
  else previewPose(dt);
  animateSwap(dt);
  if (R.light) R.light(R.video, now, dt);
  R.renderer.render(R.scene, R.camera);
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _id = new THREE.Quaternion();
function readFace(dt){
  const est = R.mindar.getLatestEstimate();
  const has = !!est;
  if (has !== R.hasFace){ R.hasFace = has; R.onFace?.(has); }
  R.face.visible = has; R.torso.visible = has;
  if (!has) return;
  R.face.matrix.set(...est.faceMatrix); R.face.matrixWorldNeedsUpdate = true;
  if (R.current) followFace(R.current.userData.face, est.metricLandmarks);
  if (R.swap?.old) followFace(R.swap.old.userData.face, est.metricLandmarks);
  // the body hangs from the neck and turns only a quarter as far as the head
  R.face.matrix.decompose(_p, _q, _s);
  _n.copy(NECK).applyMatrix4(R.face.matrix);
  const k = R.torso.userData.ready ? 1 - Math.exp(-dt * 18) : 1;
  R.torso.position.lerp(_n, k);
  R.torso.quaternion.slerp(_id.identity().slerp(_q, 0.25), k);
  R.torso.scale.lerp(_s, k);
  R.torso.userData.ready = true;
}

// The preview stands the suit on a head-form and lets a finger turn it.
function previewPose(dt){
  const D = R.drag;
  if (!D.active){ D.yaw += (Math.sin(R.t * 0.5) * 0.5 - D.yaw) * (1 - Math.exp(-dt * 1.5)); D.pitch += (Math.sin(R.t * 0.37) * 0.05 - D.pitch) * (1 - Math.exp(-dt * 1.5)); }
  R.anchor.rotation.set(D.pitch, D.yaw, 0);
}

// A dark wooden head-form and shoulders, like an armour stand in a museum.
export function headForm(){
  const wood = new THREE.MeshPhysicalMaterial({ color: '#3a2a1e', roughness: 0.55, clearcoat: 0.4 });
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), wood);
  head.scale.set(7.3, 10.6, 9.4); head.position.set(0, 1.6, -3.0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.2, 20, 32), wood);
  neck.position.set(0, -13, -3.6);
  g.add(head, neck);
  return g;
}

// ------------------------------------------------------------------ start / stop
function common(renderer, scene, camera, faceGroup, torsoGroup){
  R.renderer = renderer; R.scene = scene; R.camera = camera;
  R.look = setupLook(renderer, scene);
  R.face = faceGroup; R.torso = torsoGroup;
}

// Ask for the front camera with a sharper picture than MindAR's default request.
function hdVideo(){
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    this.video = video;
    video.setAttribute('autoplay', ''); video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    video.muted = true;
    Object.assign(video.style, { position: 'absolute', top: '0px', left: '0px', zIndex: '-2' });
    this.container.appendChild(video);
    const fake = new URLSearchParams(location.search).get('fakecam');
    const ready = () => { video.setAttribute('width', video.videoWidth); video.setAttribute('height', video.videoHeight); resolve(); };
    if (fake){ video.addEventListener('loadedmetadata', ready, { once: true }); fakeStream(fake).then((s) => { video.srcObject = s; }, reject); return; }
    if (!navigator.mediaDevices?.getUserMedia){ reject(new Error('no camera API')); return; }
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        video.addEventListener('loadedmetadata', () => { video.setAttribute('width', video.videoWidth); video.setAttribute('height', video.videoHeight); resolve(); });
        video.srcObject = stream;
      }).catch(reject);
  });
}

// Testing without a camera: ?fakecam=<image url> plays a photo (CORS-enabled) as the selfie
// video. &fakemove=1 sways it (roll, drift, nearer/farther) to test tracking in motion.
function fakeStream(src){
  return new Promise((ok, fail) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => fail(new Error('fakecam image failed to load'));
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      const g = c.getContext('2d');
      const move = new URLSearchParams(location.search).has('fakemove');
      const zoom = parseFloat(new URLSearchParams(location.search).get('fakezoom') || '1');
      const draw = () => {
        const t = performance.now() / 1000;
        g.fillStyle = '#6b6258'; g.fillRect(0, 0, c.width, c.height);
        const k = Math.min(c.width / img.width, c.height / img.height) * zoom * (move ? 1 + 0.12 * Math.sin(t * 0.7) : 1);
        g.save();
        g.translate(c.width / 2 + (move ? 90 * Math.sin(t * 0.5) : 0), c.height / 2 + (move ? 30 * Math.sin(t * 0.9) : 0));
        g.rotate(move ? 0.18 * Math.sin(t * 0.8) : 0);
        g.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
        g.restore();
      };
      draw(); setInterval(draw, 33);
      ok(c.captureStream(30));
    };
    img.src = src;
  });
}

export async function startCamera(container, { onStatus, onFace }){
  stop();
  R.mode = 'camera'; R.container = container; R.onFace = onFace;
  onStatus?.('Loading the face tracker…');
  const { MindARThree } = await import('mindar-face-three');
  const mindar = new MindARThree({ container, uiLoading: 'no', uiScanning: 'no', uiError: 'no', filterMinCF: 0.001, filterBeta: 15 });
  mindar._startVideo = hdVideo.bind(mindar);
  mindar.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  R.mindar = mindar;
  // the helmet rides the whole-face pose (the matrix MindAR's own face mesh uses)
  const face = new THREE.Group();
  face.matrixAutoUpdate = false; face.visible = false;
  face.add(occluders());
  const torso = new THREE.Group(); torso.visible = false;
  // Like a head-wear lens: the live face mesh (468 landmarks, reshaped every frame) is drawn
  // into depth only, so any part of the helmet that is behind your real face — the far flap,
  // the far side of the neck guard when you turn — hides behind it exactly.
  const faceOcc = mindar.addFaceMesh();
  faceOcc.material = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  faceOcc.renderOrder = -1;
  mindar.scene.add(faceOcc, face, torso);
  common(mindar.renderer, mindar.scene, mindar.camera, face, torso);
  onStatus?.('Starting the selfie camera…');
  try { await mindar.start(); }
  catch (e){ try { mindar.stop(); } catch { /* never started */ } R.mindar = null; throw e || new Error('camera unavailable'); }
  R.video = mindar.video;
  R.light = roomLight(R.look, R.renderer);
  R.renderer.setAnimationLoop(frame);
}

export function startPreview(container, { onFace } = {}){
  stop();
  R.mode = 'preview'; R.container = container; R.onFace = onFace;
  container.classList.add('preview');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'stage';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 800);
  const anchor = new THREE.Group();
  anchor.position.set(0, -9, -125);
  R.anchor = anchor;
  scene.add(anchor);
  const face = new THREE.Group(), torso = new THREE.Group();
  torso.position.copy(NECK);
  anchor.add(headForm(), face, torso);
  common(renderer, scene, camera, face, torso);
  onResize();
  addEventListener('resize', onResize);
  const el = renderer.domElement, D = R.drag;
  let px = 0, py = 0;
  el.addEventListener('pointerdown', (e) => { D.active = true; px = e.clientX; py = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!D.active) return; D.yaw = Math.max(-2.6, Math.min(2.6, D.yaw + (e.clientX - px) * 0.01)); D.pitch = Math.max(-0.4, Math.min(0.5, D.pitch + (e.clientY - py) * 0.005)); px = e.clientX; py = e.clientY; });
  el.addEventListener('pointerup', () => { D.active = false; });
  el.addEventListener('pointercancel', () => { D.active = false; });
  R.hasFace = true; onFace?.(true);
  renderer.setAnimationLoop(frame);
}

function onResize(){
  if (R.mode !== 'preview') return;
  const w = R.container.clientWidth, h = R.container.clientHeight;
  R.renderer.setSize(w, h);
  R.camera.aspect = w / h;
  // narrow phones: widen the view so the horns and shoulder guards stay in frame
  R.camera.fov = w / h < 0.8 ? 30 / Math.max(0.5, (w / h) / 0.8) : 30;
  R.camera.position.y = -2;
  R.camera.updateProjectionMatrix();
}

export function stop(){
  removeEventListener('resize', onResize);
  try { R.renderer?.setAnimationLoop(null); } catch { /* gone */ }
  if (R.mindar){ try { R.mindar.stop(); } catch { /* already stopped */ } R.mindar = null; }
  R.container?.querySelectorAll('video').forEach((v) => v.srcObject?.getTracks?.().forEach((t) => t.stop()));
  for (const s of R.cache.values()) disposeSuit(s);
  R.cache.clear();
  if (R.mode === 'preview') R.renderer?.dispose();
  if (R.container){ R.container.innerHTML = ''; R.container.classList.remove('preview'); }
  Object.assign(R, { mode: null, current: null, currentId: null, video: null, hasFace: false, swap: null, light: null });
}

// ------------------------------------------------------------------ photo
// What is on screen — the mirrored selfie video and the armour on top — plus a small
// Anatomy-style caption plate.
export async function snapshot(){
  const box = R.container.getBoundingClientRect();
  const k = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(box.width * k); c.height = Math.round(box.height * k);
  const g = c.getContext('2d');
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return [(r.left - box.left) * k, (r.top - box.top) * k, r.width * k, r.height * k]; };
  if (R.mode === 'camera' && R.video){
    const [x, y, w, h] = rectOf(R.video);
    g.save();
    if (getComputedStyle(R.video).transform.includes('-1')){ g.translate(x + w, y); g.scale(-1, 1); g.drawImage(R.video, 0, 0, w, h); }
    else g.drawImage(R.video, x, y, w, h);
    g.restore();
  } else {
    const gr = g.createRadialGradient(c.width / 2, c.height * 0.4, 10, c.width / 2, c.height * 0.4, c.height * 0.8);
    gr.addColorStop(0, '#6b5238'); gr.addColorStop(1, '#1c120a');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  }
  R.renderer.render(R.scene, R.camera); // draw now, so the buffer is still there
  g.drawImage(R.renderer.domElement, ...rectOf(R.renderer.domElement));
  const m = BY_ID[R.currentId];
  if (m) caption(g, c.width, c.height, k, m);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
}
function caption(g, W, H, k, m){
  const pad = 14 * k, w = Math.min(W - pad * 2, 300 * k), h = 58 * k, x = pad, y = H - h - pad;
  g.save();
  g.shadowColor = 'rgba(28,18,10,.35)'; g.shadowBlur = 10 * k;
  g.fillStyle = '#f6eddb'; roundRect(g, x, y, w, h, 6 * k); g.fill();
  g.shadowBlur = 0; g.strokeStyle = '#8c7457'; g.lineWidth = k; g.stroke();
  g.fillStyle = '#5b4630'; g.font = `${9.5 * k}px ui-monospace,Consolas,monospace`;
  g.fillText(`FIG. ${String(m.n).padStart(2, '0')} · SAMURAI WEAR`, x + 10 * k, y + 16 * k);
  g.textAlign = 'right'; g.fillText(m.era, x + w - 10 * k, y + 16 * k);
  g.textAlign = 'left'; g.fillStyle = '#2b1e13'; g.font = `900 ${20 * k}px 'Zen Maru Gothic',system-ui,sans-serif`;
  g.fillText(m.name, x + 10 * k, y + 43 * k);
  const nw = g.measureText(m.name).width;
  g.fillStyle = '#b5452f'; g.font = `700 ${16 * k}px 'Zen Maru Gothic','Yu Gothic',sans-serif`;
  g.fillText(m.jp, x + 18 * k + nw, y + 42 * k);
  g.restore();
}
function roundRect(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

window.__stage = R;
