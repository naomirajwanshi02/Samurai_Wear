// Samurai Wear: scan the card → the armour room opens → turn the camera round → pick a
// helmet and wear it (MindAR face tracking), with the face guard and armour on or off.
//
// ?demo=1     skip the card
// ?preview=1  no camera at all: the armour stands on a head-form
// ?suit=<id>  start with that suit (tosei | oyoroi)

import { SUITS, BY_ID, PARTS, EXTRA_FACTS } from './data.js';
import { scan, stopScan } from './scan.js';
import * as Stage from './stage.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const store = {
  get(k, d){ try { const v = localStorage.getItem('samurai.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('samurai.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const S = {
  phase: 'scan', suit: BY_ID[q.get('suit')] ? q.get('suit') : store.get('suit', 'tosei'),
  menpo: store.get('menpo', null), armour: store.get('armour', true), photoUrl: null, hintTimer: 0, fact: 0,
};

const overlay = (id, on) => $(id).classList.toggle('on', on);
const show = (id) => document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
let toastT = 0;
function toast(html, ms = 3200){
  const t = $('toast');
  t.innerHTML = html; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* no vibration */ } };

// ------------------------------------------------------------ 0 · camera permission
async function cameraGranted(){
  try { return (await navigator.permissions?.query({ name: 'camera' }))?.state === 'granted'; } catch { return false; }
}
async function openPerm(){
  S.phase = 'perm';
  overlay('guide', false);
  if (await cameraGranted()) return openScan();
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia){
    $('permStatus').textContent = 'This browser cannot use the camera here. Open the page over https in Safari or Chrome.';
    $('permBtn').disabled = true;
  }
  show('perm');
}
async function askCamera(){
  $('permBtn').disabled = true;
  $('permStatus').textContent = 'Waiting for you to tap “Allow”…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    stream.getTracks().forEach((t) => t.stop());
    $('permStatus').textContent = '';
    show(null);
    openScan();
  } catch (err) {
    console.error(err);
    $('permStatus').textContent = err?.name === 'NotAllowedError'
      ? 'The camera was blocked. Tap the “aA” or lock icon next to the address, allow the camera for this site, then tap Allow camera again.'
      : 'The camera did not start. Close other apps that use the camera and try again.';
  } finally { $('permBtn').disabled = false; }
}

// ------------------------------------------------------------ 1 · card
async function openScan(){
  S.phase = 'scan';
  Stage.stop();
  show(null); overlay('hud', false); overlay('guide', true);
  $('scanRetry').hidden = true;
  $('scanStatus').textContent = 'Starting camera…';
  try {
    await scan($('ar'), { onStatus: (t) => { $('scanStatus').textContent = t; }, onFound });
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || err?.name || err || '');
    $('scanStatus').textContent = /mind|fetch|404/i.test(msg) ? `Could not load the card data (${msg}).`
      : 'Camera not available. Allow camera access for this site in your browser settings, then tap Try again.';
    $('scanRetry').hidden = false;
  }
}
function onFound(){
  if (S.phase !== 'scan') return;
  S.phase = 'intro';
  overlay('guide', false);
  buzz(40);
  overlay('found', true);
  setTimeout(() => { overlay('found', false); openIntro(); }, 1300);
}

// ------------------------------------------------------------ 2 · welcome
function openIntro(){
  S.phase = 'intro';
  stopScan();
  overlay('guide', false);
  $('introImg').src = `assets/thumbs/${S.suit}.png`;
  $('camStatus').textContent = '';
  show('intro');
}

async function start(preview = false){
  $('goBtn').disabled = true;
  try {
    if (preview) Stage.startPreview($('ar'), { onFace });
    else await Stage.startCamera($('ar'), { onStatus: (t) => { $('camStatus').textContent = t; }, onFace });
  } catch (err) {
    console.error(err);
    $('goBtn').disabled = false;
    $('camStatus').textContent = 'The camera did not start. Allow camera access for this site in your browser settings and try again, or look at the armour without a camera.';
    return;
  }
  $('goBtn').disabled = false;
  S.phase = 'wear';
  show(null);
  overlay('hud', true);
  document.body.classList.toggle('preview', preview);
  Stage.setFaceGuard(menpoOn());
  Stage.setArmour(S.armour);
  buildTray();
  await select(S.suit, { quiet: true });
  hintLoop();
}

// ------------------------------------------------------------ 3 · the armour room
// The face guard follows each suit's reference until the wearer flips it themselves.
const menpoOn = () => (S.menpo === null ? BY_ID[S.suit].menpo : S.menpo);

const ICONS = {
  menpo: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 10q13-6 26 0l-1 13q-2 9-12 12Q10 32 8 23z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 12v8l-2 3h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 27q6 3 12 0" fill="none" stroke="#b5452f" stroke-width="3" stroke-linecap="round"/></svg>',
  armour: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 6h16l2 5-3 2v19H13V13l-3-2z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M13 18h14M13 23h14M13 28h14" stroke="#3f86a8" stroke-width="2"/><path d="M10 11l-6 3 1 14 5-2M30 11l6 3-1 14-5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};
function buildTray(){
  const tray = $('tray');
  tray.innerHTML = '';
  SUITS.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('aria-label', m.name);
    b.dataset.id = m.id;
    b.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span><img src="assets/thumbs/${m.id}.png" alt="" loading="lazy"><b>${m.short}</b><small>${m.jp}</small>`;
    b.addEventListener('click', () => select(m.id));
    tray.appendChild(b);
  });
  tray.appendChild(Object.assign(document.createElement('span'), { className: 'sep' }));
  for (const [key, label] of [['menpo', 'Face guard'], ['armour', 'Armour']]){
    const b = document.createElement('button');
    b.className = 'chip toggle'; b.id = `tg-${key}`;
    b.innerHTML = `${ICONS[key]}<b>${label}</b><small>${key === 'menpo' ? '面頬' : '鎧'}</small>`;
    b.addEventListener('click', () => toggle(key));
    tray.appendChild(b);
  }
  syncToggles();
}
function syncToggles(){
  $('tg-menpo')?.setAttribute('aria-pressed', menpoOn());
  $('tg-armour')?.setAttribute('aria-pressed', S.armour);
}
function toggle(key){
  buzz(12);
  if (key === 'menpo'){ S.menpo = !menpoOn(); store.set('menpo', S.menpo); Stage.setFaceGuard(S.menpo); toast(S.menpo ? '<b>Menpō 面頬</b> on: an iron face guard with a fierce red mouth.' : 'Face guard off. A silk cord under the chin ties the helmet on.', 2600); }
  else { S.armour = !S.armour; store.set('armour', S.armour); Stage.setArmour(S.armour); }
  syncToggles();
}

async function select(id, { quiet = false } = {}){
  if (Stage.isBuilding()) return;
  const m = BY_ID[id];
  S.suit = id; store.set('suit', id);
  document.querySelectorAll('#tray .chip[data-id]').forEach((c) => c.setAttribute('aria-selected', c.dataset.id === id));
  $('ncFig').textContent = `Fig. ${String(m.n).padStart(2, '0')}`;
  $('ncRole').textContent = `${m.era} · ${m.role}`;
  $('ncName').textContent = m.name;
  $('ncJp').textContent = `${m.jp} · ${m.kana}`;
  $('ncBlurb').textContent = m.blurb;
  $('namecard').classList.remove('pop'); void $('namecard').offsetWidth; $('namecard').classList.add('pop');
  overlay('carving', true);
  if (!quiet) buzz(15);
  Stage.setFaceGuard(menpoOn());
  await Stage.wear(id);
  overlay('carving', false);
  syncToggles();
  setHint();
}

function setHint(){
  $('hint').innerHTML = document.body.classList.contains('preview')
    ? 'Drag to turn the armour and see the <b>neck guard</b> from behind'
    : 'Turn your head to the side to see the <b>neck guard</b> and the <b>flaps</b>';
}
function hintLoop(){
  clearInterval(S.hintTimer);
  let n = 0;
  S.hintTimer = setInterval(() => {
    if (S.phase !== 'wear') return;
    n++;
    if (n % 4 === 1) $('hint').innerHTML = 'Tap <b>Face guard</b> to put the iron mask on or off';
    else if (n % 4 === 2) $('hint').innerHTML = 'Tap the <b>round button</b> to take a photo';
    else if (n % 4 === 3) $('hint').innerHTML = 'Try the other helmet from the bottom row';
    else setHint();
  }, 6000);
}

function onFace(has){ overlay('faceGuide', !has && S.phase === 'wear'); }

// Did you know: the suit's own fact first, then one part at a time, then the extras.
function nextFact(){
  const m = BY_ID[S.suit];
  const all = [m.fact, ...PARTS.map((p) => `<b>${p.name} ${p.jp}</b> is ${p.text}`), ...EXTRA_FACTS];
  const html = all[S.fact % all.length];
  S.fact++;
  toast(`<span class="cap">Did you know?</span><br>${html}`, 6500);
}

async function takePhoto(){
  if (Stage.isBuilding()) return;
  buzz(30);
  $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on');
  const blob = await Stage.snapshot();
  if (!blob) return;
  if (S.photoUrl) URL.revokeObjectURL(S.photoUrl);
  S.photoUrl = URL.createObjectURL(blob);
  const m = BY_ID[S.suit];
  $('photoImg').src = S.photoUrl;
  $('photoName').textContent = `${m.name} ${m.jp}`;
  $('saveBtn').href = S.photoUrl;
  $('saveBtn').download = `samurai-${m.id}.jpg`;
  const file = new File([blob], `samurai-${m.id}.jpg`, { type: 'image/jpeg' });
  const canShare = !!navigator.canShare?.({ files: [file] });
  $('shareBtn').hidden = !canShare;
  $('shareBtn').onclick = () => navigator.share({ files: [file], title: `Me in ${m.name} armour` }).catch(() => {});
  show('photo');
}

// ------------------------------------------------------------ wiring
$('permBtn').addEventListener('click', askCamera);
$('scanRetry').addEventListener('click', openScan);
$('scanSkip').addEventListener('click', () => { stopScan(); overlay('guide', false); openIntro(); });
$('goBtn').addEventListener('click', () => start(false));
$('previewBtn').addEventListener('click', () => start(true));
$('closeBtn').addEventListener('click', () => { clearInterval(S.hintTimer); overlay('hud', false); overlay('faceGuide', false); openScan(); });
$('factBtn').addEventListener('click', nextFact);
$('shutter').addEventListener('click', takePhoto);
$('photoBack').addEventListener('click', () => show(null));
$('errBtn').addEventListener('click', () => { $('err').hidden = true; location.reload(); });

const fromTracker = (s) => /mind-?ar/i.test(String(s));
addEventListener('error', (e) => { const s = e.error?.stack || e.message; if (fromTracker(s + e.filename)) return; $('errText').textContent = String(s); $('err').hidden = false; });
addEventListener('unhandledrejection', (e) => { const s = e.reason?.stack || e.reason; if (fromTracker(s)) return; $('errText').textContent = String(s); $('err').hidden = false; });

window.__samurai = { S, select, Stage, start, toggle };

if (q.has('preview')){ openIntro(); start(true); }
else if (q.has('demo')) openIntro();
else openPerm();
