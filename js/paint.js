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

// Egawa: stencilled deer leather as on Heian–Kamakura ō-yoroi: a buff ground of tiny indigo
// "hail" dots (arare-ji) with peony roundels in indigo and madder red.
export function egawaTexture(aniso = 8, seed = 31){
  const S = 512;
  const [c, g] = canvas(S, S);
  const r = rng(seed);
  g.fillStyle = '#dccdaa'; g.fillRect(0, 0, S, S);
  // hail ground
  g.fillStyle = '#3a4f78';
  for (let y = 8; y < S; y += 16) for (let x = (y / 16) % 2 ? 8 : 16; x < S; x += 16){ g.beginPath(); g.arc(x, y, 3.4, 0, 7); g.fill(); }
  // peony roundels on a lattice (wraps seamlessly)
  const peony = (cx, cy, R) => {
    g.fillStyle = '#e4d9bf'; g.beginPath(); g.arc(cx, cy, R * 1.25, 0, 7); g.fill();
    for (let k = 0; k < 4; k++){ // leaves
      const a = k * Math.PI / 2 + Math.PI / 4;
      g.fillStyle = '#2f5a4a'; g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95, R * 0.42, R * 0.2, a, 0, 7); g.fill();
    }
    for (let k = 0; k < 8; k++){ // petals
      const a = k * Math.PI / 4 + r() * 0.2;
      g.fillStyle = k % 2 ? '#2c3f6b' : '#3d5689';
      g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, R * 0.42, R * 0.26, a, 0, 7); g.fill();
    }
    g.fillStyle = '#a8392b'; g.beginPath(); g.arc(cx, cy, R * 0.3, 0, 7); g.fill();
    g.fillStyle = '#e0b74e'; g.beginPath(); g.arc(cx, cy, R * 0.12, 0, 7); g.fill();
  };
  for (const [x, y] of [[128, 128], [384, 384], [384, 128], [128, 384]]){
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if ((x === 128) === (y === 128)) peony(x + dx, y + dy, 60);
  }
  for (const [x, y] of [[384, 128], [128, 384]]) for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) peony(x + dx, y + dy, 44);
  const t = tex(c, { aniso });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
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

// ------------------------------------------------------------------ the 1650 gusoku (Met 36.25.41)
// Black lacquer with silver scrollwork (karakusa) and, on the flaps, a border of gilt studs.
export function karakusaTexture({ studs = false, aniso = 8, seed = 41 } = {}){
  const W = 512, H = 512;
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, '#26221f'); gr.addColorStop(1, '#141210');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // speckled lacquer
  for (let i = 0; i < 900; i++){ g.fillStyle = `rgba(150,140,130,${0.05 + r() * 0.1})`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
  // silver scrolls: curling vines with small leaves, drawn as continuous strokes
  g.lineCap = 'round'; g.lineJoin = 'round';
  const x0 = studs ? 30 : 0, x1 = studs ? W - 120 : W;
  for (let k = 0; k < 70; k++){
    let x = x0 + r() * (x1 - x0), y = r() * H, a = r() * 6.28, w = 1.9;
    g.strokeStyle = '#d9d6d0'; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 46; s++){
      a += 0.12 + 0.12 * Math.sin(s * 0.3 + k);
      x += Math.cos(a) * 2.2; y += Math.sin(a) * 2.2;
      g.lineTo(x, y);
      if (s % 11 === 5){ g.stroke(); g.fillStyle = '#d9d6d0'; g.beginPath(); g.ellipse(x + Math.cos(a + 1.6) * 4, y + Math.sin(a + 1.6) * 4, 3.6, 1.5, a + 1.6, 0, 7); g.fill(); g.beginPath(); g.moveTo(x, y); }
    }
    g.stroke();
  }
  if (studs){
    // two columns of gilt studs down the outer edge, and a row along the top
    for (let col = 0; col < 2; col++) for (let y = 18; y < H; y += 26){
      const x = W - 70 + col * 34;
      const sg = g.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
      sg.addColorStop(0, '#ffd89a'); sg.addColorStop(0.5, '#e3973a'); sg.addColorStop(1, '#7a4614');
      g.fillStyle = sg; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill();
    }
  }
  const t = tex(c, { aniso });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// The breastplate's centre panel: brown, with a silver dragon coiling through clouds.
export function dragonTexture(aniso = 8){
  const W = 512, H = 640;
  const [c, g] = canvas(W, H);
  const r = rng(53);
  g.fillStyle = '#5a3324'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1500; i++){ g.fillStyle = `rgba(30,14,8,${0.05 + r() * 0.12})`; g.fillRect(r() * W, r() * H, 2, 2); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  // clouds: clusters of curling puffs
  const cloud = (cx, cy, s) => {
    for (let k = 0; k < 5; k++){
      const x = cx + (k - 2) * 22 * s, y = cy + Math.sin(k * 1.7) * 10 * s;
      g.fillStyle = '#b9b0ab'; g.beginPath(); g.arc(x, y, 18 * s, 0, 7); g.fill();
      g.strokeStyle = '#7d706a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 10 * s, 0.4, 5.2); g.stroke();
    }
    g.strokeStyle = '#e7e1dc'; g.lineWidth = 2;
    for (let k = 0; k < 5; k++){ const x = cx + (k - 2) * 22 * s; g.beginPath(); g.arc(x - 4 * s, cy - 5 * s, 6 * s, 3.4, 5.6); g.stroke(); }
  };
  [[120, 90, 1.1], [380, 110, 1], [90, 330, 0.9], [420, 360, 1.1], [250, 560, 1.2], [140, 520, 0.8], [380, 560, 0.9]].forEach(([x, y, s]) => cloud(x, y, s));
  // the dragon: a serpentine scaled body in an S, with head, mane and claws
  const path = [];
  for (let i = 0; i <= 120; i++){ const t = i / 120; path.push([256 + 150 * Math.sin(t * 6.6 + 0.6) * (1 - 0.3 * t), 70 + 480 * t + 40 * Math.sin(t * 9)]); }
  for (const [lw, col] of [[34, '#6c5d57'], [28, '#c9c1bc'], [16, '#a99e98']]){
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  }
  // scales along the body
  g.strokeStyle = '#6c5d57'; g.lineWidth = 1.6;
  for (let i = 2; i < path.length - 2; i += 2){ const [x, y] = path[i]; g.beginPath(); g.arc(x, y, 7, 0.3, 2.8); g.stroke(); }
  // the spine flame
  g.strokeStyle = '#e7e1dc'; g.lineWidth = 2.4;
  for (let i = 4; i < path.length - 4; i += 3){ const [x, y] = path[i], [x2, y2] = path[i + 1]; const nx = -(y2 - y), ny = x2 - x, l = Math.hypot(nx, ny) || 1; g.beginPath(); g.moveTo(x + nx / l * 14, y + ny / l * 14); g.lineTo(x + nx / l * 24, y + ny / l * 24 - 4); g.stroke(); }
  // head at the top of the S
  const [hx, hy] = path[0];
  g.fillStyle = '#c9c1bc'; g.strokeStyle = '#6c5d57'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(hx - 10, hy - 6, 34, 22, -0.3, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#3a2a22'; g.beginPath(); g.arc(hx - 18, hy - 12, 4.5, 0, 7); g.fill();
  g.strokeStyle = '#e7e1dc'; g.lineWidth = 2.5;
  for (let k = 0; k < 6; k++){ g.beginPath(); g.moveTo(hx + 10, hy - 14 + k * 5); g.bezierCurveTo(hx + 40, hy - 30 + k * 6, hx + 50, hy + k * 8, hx + 70, hy - 10 + k * 9); g.stroke(); }
  g.beginPath(); g.moveTo(hx - 40, hy); g.bezierCurveTo(hx - 70, hy + 10, hx - 80, hy - 30, hx - 100, hy - 20); g.stroke(); // whisker
  // claws
  for (const i of [30, 60, 92]){ const [x, y] = path[i]; g.strokeStyle = '#c9c1bc'; g.lineWidth = 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y + 18); g.stroke(); g.lineWidth = 3; for (let k = -1; k <= 1; k++){ g.beginPath(); g.moveTo(x + 30, y + 18); g.lineTo(x + 40 + k * 4, y + 26 + k * 6); g.stroke(); } }
  // a fine silver frame
  g.strokeStyle = '#cfcac6'; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16);
  return tex(c, { aniso });
}

// Haidate (thigh guard): small black lacquered scales laced in grey, with an olive kneecap
// plate of tortoise-shell hexagons.
export function haidateTexture(aniso = 8){
  const W = 512, H = 512;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#1a1817'; g.fillRect(0, 0, W, H);
  for (let y = 6; y < H; y += 22) for (let x = (y / 22) % 2 ? 0 : 7; x < W; x += 14){
    g.fillStyle = '#2e2b29'; g.fillRect(x + 1, y, 11, 16);
    g.fillStyle = '#8a827c'; g.fillRect(x + 5, y + 2, 3, 12);
  }
  const knee = (cx, cy) => {
    g.fillStyle = '#4a4a2c'; g.beginPath(); g.ellipse(cx, cy, 70, 50, 0, 0, 7); g.fill();
    g.strokeStyle = '#2a2a18'; g.lineWidth = 4;
    for (let y = -40; y <= 40; y += 22) for (let x = -60 + (y / 22 % 2 ? 11 : 0); x <= 60; x += 24){
      if ((x / 70) ** 2 + (y / 50) ** 2 > 0.8) continue;
      g.beginPath(); for (let k = 0; k <= 6; k++){ const a = k * Math.PI / 3; const px = cx + x + Math.cos(a) * 10, py = cy + y + Math.sin(a) * 10; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
    }
    g.strokeStyle = '#a99a5a'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, 70, 50, 0, 0, 7); g.stroke();
  };
  knee(W / 2, H * 0.72);
  return tex(c, { aniso });
}
