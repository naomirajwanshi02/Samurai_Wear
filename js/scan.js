// Card recognition: MindAR image tracking (mind-ar 1.2.5 + three 0.160.0, the same
// pins as Ramen_Builder and sushi-ar) watches the back camera until it sees the
// Samurai Wear card, then shuts down completely so the selfie camera can take over.

const params = new URLSearchParams(location.search);
export const TARGET_SRC = params.get('target') || './targets.mind';

let current = null;

export async function scan(container, { onStatus, onFound }){
  stopScan();
  onStatus('Loading the card scanner…');
  const { MindARThree } = await import('mindar-image-three');
  const mindar = new MindARThree({
    container, imageTargetSrc: TARGET_SRC, uiScanning: 'no', uiLoading: 'no', uiError: 'no',
    filterMinCF: 0.001, filterBeta: 1000, warmupTolerance: 3, missTolerance: 10,
  });
  current = mindar;
  const anchor = mindar.addAnchor(0);
  let found = false;
  anchor.onTargetFound = () => {
    if (found) return;
    found = true;
    stopScan();
    onFound();
  };
  onStatus('Starting camera…');
  try { await mindar.start(); }
  catch (e){ stopScan(); throw e || new Error('camera unavailable'); }
  if (found) return;
  mindar.renderer.setAnimationLoop(() => mindar.renderer.render(mindar.scene, mindar.camera));
  onStatus('Looking for the card…');
}

export function stopScan(){
  if (!current) return;
  const m = current;
  current = null;
  try { m.renderer.setAnimationLoop(null); } catch { /* fine */ }
  try { m.controller.stopProcessVideo(); } catch { /* fine */ }
  try { m.stop(); } catch { /* never started */ }
  try { m.renderer.dispose(); } catch { /* fine */ }
  const c = m.container;
  if (c){ c.querySelectorAll('video').forEach((v) => v.srcObject?.getTracks?.().forEach((t) => t.stop())); c.innerHTML = ''; }
}
