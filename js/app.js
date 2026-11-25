// Samurai Wear: scan the card → the armour room opens → turn the camera round → pick a
// helmet and wear it (MindAR face tracking), with the face guard and armour on or off.
//
// ?demo=1     skip the card
// ?preview=1  no camera at all: the armour stands on a head-form
// ?suit=gusoku  the suit (there is one: the Met's gusoku, c. 1650)

import { SUITS, BY_ID } from './data.js';
import { scan, stopScan } from './scan.js';
import * as Stage from './stage.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const store = {
  get(k, d){ try { const v = localStorage.getItem('samurai.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('samurai.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const S = {
  phase: 'scan', suit: BY_ID[q.get('suit')] ? q.get('suit') : BY_ID[store.get('suit', '')] ? store.get('suit', '') : SUITS[0].id,
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
    $('camStatus').textContent = 'The camera did not start. Allow camera access for this site in your browser settings and try again.';
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
  buildSlides(); showInfo('suit');
}

// ------------------------------------------------------------ 3 · the armour room
// The face guard follows each suit's reference until the wearer flips it themselves.
const menpoOn = () => (S.menpo === null ? BY_ID[S.suit].menpo : S.menpo);

function buildTray(){
  const tray = $('tray');
  tray.innerHTML = '';
  SUITS.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('aria-label', m.name);
    b.dataset.id = m.id;
    b.innerHTML = `<img src="assets/thumbs/${m.id}.png" alt="" loading="lazy"><b>${m.short}</b>`;
    b.addEventListener('click', () => select(m.id));
    tray.appendChild(b);
  });
  tray.appendChild(Object.assign(document.createElement('span'), { className: 'sep' }));
  for (const [key, label] of [['menpo', 'Face guard'], ['armour', 'Armour']]){
    const b = document.createElement('button');
    b.className = 'chip toggle'; b.id = `tg-${key}`;
    b.innerHTML = `<img src="assets/thumbs/${S.suit}-${key}.png" alt=""><b>${label}</b>`;
    b.addEventListener('click', () => toggle(key));
    tray.appendChild(b);
  }
  syncToggles();
}
function syncToggles(){
  $('tg-menpo')?.setAttribute('aria-pressed', menpoOn());
  $('tg-armour')?.setAttribute('aria-pressed', S.armour);
  fillSlides();
}
function toggle(key){
  buzz(12);
  if (key === 'menpo'){ S.menpo = !menpoOn(); store.set('menpo', S.menpo); Stage.setFaceGuard(S.menpo); }
  else { S.armour = !S.armour; store.set('armour', S.armour); Stage.setArmour(S.armour); }
  syncToggles();
  // touching an option brings the panel back, on that option's page
  showInfo(key === 'menpo' ? 'menpo' : 'armour');
}

// ------------------------------------------------------------ the information panel
// All the words live in the panel at the top, one page per subject; swipe sideways to move
// between pages (or tap the dots). Its small cross hides it; touching an option at the bottom
// or the i button brings it back.
const PAGES = [
  { id: 'suit' },
  { id: 'menpo' },
  { id: 'armour' },
  { id: 'tips' },
];
function pageContent(id){
  const m = BY_ID[S.suit];
  const state = (on) => `<span class="state ${on ? 'on' : 'off'}">${on ? 'On' : 'Off'}</span>`;
  if (id === 'suit') return { title: m.name, text: m.blurb };
  if (id === 'menpo') return { title: `Face guard ${state(menpoOn())}`, text: menpoOn()
    ? 'The menpō: an iron face mask with a fierce mouth, gilt teeth and a white horsehair moustache. Tap <b>Face guard</b> to take it off.'
    : 'Face guard off: you can see your own face. The orange silk cords still tie the helmet on. Tap <b>Face guard</b> to put the iron mask back on.' };
  if (id === 'armour') return { title: `Armour ${state(S.armour)}`, text: S.armour
    ? 'The dō, laced in gold with a silver dragon on the chest, with shoulder guards, gold tassels and an orange cord belt. Tap <b>Armour</b> to take it off.'
    : 'Armour off: just the helmet. Tap <b>Armour</b> to put the body armour back on.' };
  return { title: 'How to wear it', text: document.body.classList.contains('preview')
    ? 'Drag to turn the armour and see the neck guard from behind. Tap the round button to take a photo.'
    : 'Turn your head to the side to see the neck guard and the flaps. Tap the round button to take a photo.' };
}
function buildSlides(){
  $('slides').innerHTML = PAGES.map((p) => `<section class="slide" data-page="${p.id}" role="group" aria-roledescription="page"><b class="nc-title"></b><p class="nc-blurb"></p></section>`).join('');
  $('dots').innerHTML = PAGES.map((p, i) => `<button class="dot" role="tab" data-i="${i}" aria-label="Page ${i + 1}"></button>`).join('');
  $('dots').querySelectorAll('.dot').forEach((d) => d.addEventListener('click', () => goPage(+d.dataset.i)));
  $('slides').addEventListener('scroll', () => {
    clearTimeout(S.slideT); S.slideT = setTimeout(markDot, 60);
  }, { passive: true });
  fillSlides(); markDot();
}
function fillSlides(){
  $('slides').querySelectorAll('.slide').forEach((el) => {
    const c = pageContent(el.dataset.page);
    el.querySelector('.nc-title').innerHTML = c.title;
    el.querySelector('.nc-blurb').innerHTML = c.text;
  });
}
const pageIndex = () => Math.round($('slides').scrollLeft / Math.max(1, $('slides').clientWidth));
function markDot(){
  const i = pageIndex();
  $('dots').querySelectorAll('.dot').forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
}
function goPage(i, smooth = true){
  const el = $('slides');
  el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  setTimeout(markDot, smooth ? 400 : 0);
}
function showInfo(pageId){
  const nc = $('namecard'), wasHidden = nc.hidden;
  nc.hidden = false;
  $('infoBtn').setAttribute('aria-expanded', 'true');
  const i = PAGES.findIndex((p) => p.id === pageId);
  if (i >= 0) goPage(i, !wasHidden);
  if (wasHidden){ nc.classList.remove('pop'); void nc.offsetWidth; nc.classList.add('pop'); }
}
function hideInfo(){ $('namecard').hidden = true; $('infoBtn').setAttribute('aria-expanded', 'false'); }

async function select(id, { quiet = false } = {}){
  if (Stage.isBuilding()) return;
  const m = BY_ID[id];
  S.suit = id; store.set('suit', id);
  document.querySelectorAll('#tray .chip[data-id]').forEach((c) => c.setAttribute('aria-selected', c.dataset.id === id));
  overlay('carving', true);
  if (!quiet) buzz(15);
  Stage.setFaceGuard(menpoOn());
  await Stage.wear(id);
  overlay('carving', false);
  syncToggles();
}


function onFace(has){ overlay('faceGuide', !has && S.phase === 'wear'); }


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
  $('saveBtn').href = S.photoUrl;
  $('saveBtn').download = `samurai-${m.id}.jpg`;
  const file = new File([blob], `samurai-${m.id}.jpg`, { type: 'image/jpeg' });
  const canShare = !!navigator.canShare?.({ files: [file] });
  $('shareBtn').hidden = !canShare;
  $('shareBtn').onclick = () => navigator.share({ files: [file], title: `Me in ${m.name} armour` }).catch(() => {});
  show('photo');
}

// ------------------------------------------------------------ wiring
const HUB = 'https://naomirajwanshi02.github.io/Scan_To_Wear/';
$('permBtn').addEventListener('click', askCamera);
$('scanRetry').addEventListener('click', openScan);
$('scanSkip').addEventListener('click', () => { stopScan(); overlay('guide', false); openIntro(); });
$('goBtn').addEventListener('click', () => start(false));
$('guideClose').addEventListener('click', () => { stopScan(); location.href = HUB; });
// as in Noh_Masks, every cross leaves for the Scan to Wear scanning screen, where this interaction is linked from
$('closeBtn').addEventListener('click', () => { try { Stage.stop(); } catch { /* fine */ } location.href = HUB; });
$('infoClose').addEventListener('click', hideInfo);
// the i button opens the panel when it is closed and closes it when it is open
$('infoBtn').addEventListener('click', () => ($('namecard').hidden ? showInfo() : hideInfo()));
// the welcome card's cross
$('introExit').addEventListener('click', () => { stopScan(); location.href = HUB; });
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
