// Canvas painting for the armour: laced lames (odoshi), stencilled leather, iron and
// lacquer grain, crests. Every painter draws twice: once in colour (the map) and once in
// grey (the bump map), from the same layout, so the cords stand up from the plates.

import * as THREE from 'three';

export function rng(seed){ let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

export function canvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

export function tex(c, { srgb = true, aniso = 8, wrap = false } = {}){
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (wrap){ t.wrapS = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

// Grey levels used for the bump pass.
const BUMP = {
  plate: '#505050', plateHi: '#787878', plateLo: '#202020', gap: '#101010', cord: '#d0d0d0', cordLo: '#909090', cordHi: '#f0f0f0',
  dot: '#ffffff', knot: '#e8e8e8', knot2: '#c0c0c0', leather: '#6a6a6a', leatherInk: '#585858', leatherRim: '#8a8a8a', cloud: '#b0b0b0', cloudLo: '#303030',
};

// ------------------------------------------------------------------ laced lames
// spec: { lames, cols, style: 'kebiki' | 'sugake', pal: {...}, dots, knots, clouds, leather: {u0,u1,v0,v1} (0–1, v up), seed }
// Lame 0 is the top one. The canvas maps u (0–1 around) × v (0 bottom → 1 top).
export function lamesTexture(spec, aniso = 8){
  const W = 1024, H = Math.min(1024, 160 * spec.lames);
  const [c1, g1] = canvas(W, H), [c2, g2] = canvas(W, H);
  paintLames(g1, W, H, spec, spec.pal);
  paintLames(g2, W, H, spec, BUMP);
  const map = tex(c1, { aniso }), bump = tex(c2, { srgb: false, aniso });
  return { map, bump };
}

function paintLames(g, W, H, S, P){
  const r = rng(S.seed || 7);
  const lh = H / S.lames, cw = W / S.cols;
  g.fillStyle = P.gap; g.fillRect(0, 0, W, H);
  for (let L = 0; L < S.lames; L++){
    const y0 = L * lh, y1 = y0 + lh;
    // the plate
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, P.plateHi); gr.addColorStop(0.22, P.plate); gr.addColorStop(0.85, P.plate); gr.addColorStop(1, P.plateLo);
    g.fillStyle = gr; g.fillRect(0, y0, W, lh);
    if (S.style === 'kebiki'){
      // scale tops (kozane) peep out above the dense lacing as a row of little arches
      const top = y0 + lh * (S.plateFrac || 0.2);
      for (let i = 0; i < S.cols * 2; i++){
        const x = (i + 0.5) * cw / 2;
        g.fillStyle = P.plateHi; g.beginPath(); g.ellipse(x, top, cw * 0.24, lh * 0.12, 0, Math.PI, 0); g.fill();
      }
      for (let i = 0; i < S.cols; i++){
        const x = i * cw + cw * 0.1, w = cw * 0.8;
        cord(g, x, top, w, y1 - top - lh * 0.04, P, r);
      }
    } else {
      // sugake: the lacquered plate shows, laced with spaced pairs of cords
      g.strokeStyle = P.plateHi; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y0 + 3); g.lineTo(W, y0 + 3); g.stroke();
      for (let i = 0; i < S.cols; i += 4){
        const x = i * cw + cw * 1.2;
        cord(g, x, y0 + lh * 0.04, cw * 0.55, lh * 0.94, P, r);
        cord(g, x + cw * 0.85, y0 + lh * 0.04, cw * 0.55, lh * 0.94, P, r);
      }
      // the binding cord (mimi-ito) along the lower edge
      for (let i = 0; i < S.cols; i++){ g.fillStyle = i % 2 ? P.cord : P.cordLo; g.fillRect(i * cw, y1 - lh * 0.1, cw * 0.9, lh * 0.06); }
    }
    if (S.dots){
      for (let i = 0; i < S.cols; i += 2){
        const x = (i + (L % 2 ? 1.5 : 0.5)) * cw, y = y0 + lh * (S.style === 'kebiki' ? (S.plateFrac || 0.2) * 0.5 : 0.5);
        if (S.style === 'sugake' && i % 4 === 0) continue;
        g.fillStyle = P.dot; g.beginPath(); g.arc(x, y, Math.min(cw, lh) * 0.16, 0, 7); g.fill();
      }
    }
    if (S.clouds && L === S.lames - 1) clouds(g, W, y0, lh, P, r);
    if (S.knots && L === S.lames - 1){
      // hishinui: rows of red and white cross-knots along the bottom edge
      for (let i = 0; i < S.cols; i += 2){
        const x = (i + 1) * cw, y = y1 - lh * 0.2, s = Math.min(cw, lh * 0.2) * 0.75;
        g.strokeStyle = (i / 2) % 2 ? P.knot : P.knot2; g.lineWidth = s * 0.45; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke();
      }
    }
    // shadow under each lame edge
    g.fillStyle = P.gap; g.fillRect(0, y1 - 2, W, 2);
  }
  if (S.leather) leather(g, W, H, S.leather, P, r);
}

function cord(g, x, y, w, h, P, r){
  g.fillStyle = P.cord; g.fillRect(x, y, w, h);
  g.fillStyle = P.cordLo; g.fillRect(x + w * 0.72, y, w * 0.28, h);
  g.fillStyle = P.cordHi; g.fillRect(x + w * 0.12, y, w * 0.14, h);
  // the silk braid: little diagonal twill marks
  g.strokeStyle = P.cordLo; g.lineWidth = 1.2;
  for (let yy = y + 2; yy < y + h - 2; yy += 5){ g.beginPath(); g.moveTo(x + 1, yy); g.lineTo(x + w - 1, yy + 3 + r()); g.stroke(); }
}

function clouds(g, W, y0, lh, P, r){
  // lacquered relief scrolls along the bottom plate of the cuirass
  g.lineCap = 'round';
  for (let x = 30; x < W; x += 120){
    const cy = y0 + lh * 0.55, R = lh * 0.26;
    for (const [col, lw] of [[P.cloudLo, 9], [P.cloud, 5]]){
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath(); g.arc(x, cy, R, Math.PI * 0.2, Math.PI * 1.9); g.stroke();
      g.beginPath(); g.arc(x + R * 0.5, cy, R * 0.45, Math.PI * 1.1, Math.PI * 2.6); g.stroke();
      g.beginPath(); g.moveTo(x + R, cy + R * 0.4); g.bezierCurveTo(x + R * 2, cy + R, x + R * 2.6, cy - R * 0.8, x + R * 3.4, cy); g.stroke();
    }
  }
}

// Stencilled deer-skin (egawa): pale ground, indigo and red little motifs, a rim.
function leather(g, W, H, Lr, P, r){
  const x0 = Lr.u0 * W, x1 = Lr.u1 * W, y0 = (1 - Lr.v1) * H, y1 = (1 - Lr.v0) * H;
  g.fillStyle = P.leatherRim; g.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16);
  g.fillStyle = P.leather; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  leatherPattern(g, x0, y0, x1 - x0, y1 - y0, P, r);
}
export function leatherPattern(g, x0, y0, w, h, P, r){
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  const step = 26;
  for (let y = y0 + step / 2, row = 0; y < y0 + h; y += step * 0.8, row++){
    for (let x = x0 + (row % 2 ? step / 2 : 0); x < x0 + w + step; x += step){
      if (r() < 0.78){
        // a little three-lobed leaf
        g.fillStyle = P.leatherInk;
        for (let k = 0; k < 3; k++){ const a = k * 2.094 + row; g.beginPath(); g.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 4.2, 2.4, a, 0, 7); g.fill(); }
      } else {
        g.fillStyle = P.leatherRed || P.leatherInk; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill();
      }
    }
  }
  g.restore();
}

// ------------------------------------------------------------------ surfaces
// Iron or lacquer grain: speckle, rust blooms and fine streaks.
export function grainTexture({ base, spot, streak, seed = 3, size = 512 }, aniso = 8){
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++){
    const x = r() * size, y = r() * size, R = 4 + r() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, spot); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.18 + r() * 0.3; g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
  }
  g.globalAlpha = 0.25; g.strokeStyle = streak; g.lineWidth = 1;
  for (let i = 0; i < 500; i++){ const x = r() * size, y = r() * size; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 6 + r() * 16); g.stroke(); }
  g.globalAlpha = 1;
  const t = tex(c, { aniso });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A gilt crest disc: rings of beads and an eight-petal flower.
export function crestTexture(aniso = 8){
  const S = 256;
  const [c, g] = canvas(S, S);
  const gr = g.createRadialGradient(S * 0.4, S * 0.35, 10, S / 2, S / 2, S / 2);
  gr.addColorStop(0, '#f4dc8e'); gr.addColorStop(0.6, '#c99a3e'); gr.addColorStop(1, '#7a5520');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#6d4a1a'; g.lineWidth = 5; g.beginPath(); g.arc(S / 2, S / 2, S * 0.44, 0, 7); g.stroke();
  for (let i = 0; i < 24; i++){ const a = i / 24 * 6.283; g.fillStyle = '#fff1bd'; g.beginPath(); g.arc(S / 2 + Math.cos(a) * S * 0.38, S / 2 + Math.sin(a) * S * 0.38, 5, 0, 7); g.fill(); }
  for (let i = 0; i < 8; i++){
    const a = i / 8 * 6.283;
    g.save(); g.translate(S / 2, S / 2); g.rotate(a);
    g.fillStyle = '#e8c56a'; g.strokeStyle = '#6d4a1a'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, -S * 0.2, S * 0.07, S * 0.13, 0, 0, 7); g.fill(); g.stroke();
    g.restore();
  }
  g.fillStyle = '#6d4a1a'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.07, 0, 7); g.fill();
  g.fillStyle = '#f4dc8e'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.045, 0, 7); g.fill();
  return tex(c, { aniso });
}

// Stencilled leather for flaps (fukigaeshi) and the chest panel.
export function leatherTexture(P, aniso = 8, seed = 11){
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = P.leather; g.fillRect(0, 0, S, S);
  leatherPattern(g, 0, 0, S, S, P, rng(seed));
  const t = tex(c, { aniso });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
