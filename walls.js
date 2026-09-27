/* Murs et murets : tracés à la main sur le plan 2D ou issus de la BD TOPO (construction linéaire « Mur »).
   Mur suivant le relief, épaisseur selon le type, chaperon ; textures dessinées avec relief (carte de normales) :
   pierre, galets roulés en arêtes de poisson (typiques du Dauphiné), pisé enduit, béton. Module ES. */
import * as THREE from 'three';

const rng = seed => { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; s = s || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const WALL_TYPES = {
  enceinte: { label: 'Mur d\'enceinte', height: 2.2, thick: .5 },
  muret: { label: 'Muret', height: .8, thick: .4 },
  soutenement: { label: 'Mur de soutènement', height: 1.2, thick: .5 },
};
export const WALL_MATERIALS = { pierre: 'Pierre', galets: 'Galets', pise: 'Pisé enduit', beton: 'Béton' };

// ---------- Textures : couleur + hauteur → carte de normales (2 m × 2 m par motif) ----------
const TEX = 512, cache = {};
function normalFromHeight(hc, strength = 3) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'), out = g.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
    out.data[k] = (-dx / l * .5 + .5) * 255; out.data[k + 1] = (dy / l * .5 + .5) * 255; out.data[k + 2] = (1 / l * .5 + .5) * 255; out.data[k + 3] = 255;
  }
  g.putImageData(out, 0, 0); return cv;
}
function noise(g, r, n, a, size = 3) { for (let i = 0; i < n; i++) { g.fillStyle = r() < .5 ? `rgba(255,255,255,${r() * a})` : `rgba(0,0,0,${r() * a})`; g.fillRect(r() * TEX, r() * TEX, 1 + r() * size, 1 + r() * size); } }
// Dessine une forme sur la couleur et la hauteur, répétée pour que le motif se raccorde
function tiled(fn, x, y, rad) { for (const ox of [-TEX, 0, TEX]) for (const oy of [-TEX, 0, TEX]) if (x + ox > -rad && x + ox < TEX + rad && y + oy > -rad && y + oy < TEX + rad) fn(x + ox, y + oy); }
function stoneShape(g, x, y, rx, ry, rot, r) {
  g.beginPath(); const n = 9;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, k = .8 + r() * .25, px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k; const cx = x + px * Math.cos(rot) - py * Math.sin(rot), cy = y + px * Math.sin(rot) + py * Math.cos(rot); i ? g.lineTo(cx, cy) : g.moveTo(cx, cy); }
  g.closePath();
}
function makeTex(mat) {
  const cv = document.createElement('canvas'), hc = document.createElement('canvas'); cv.width = cv.height = hc.width = hc.height = TEX;
  const g = cv.getContext('2d'), gh = hc.getContext('2d'), r = rng('wall' + mat);
  const stones = (list, mortar, tones) => {
    g.fillStyle = mortar; g.fillRect(0, 0, TEX, TEX); noise(g, r, 3000, .08); gh.fillStyle = '#303030'; gh.fillRect(0, 0, TEX, TEX);
    for (const s of list) {
      const tone = tones[Math.floor(r() * tones.length)], seed = r() * 1e6;
      tiled((x, y) => {
        const rr = rng(seed);
        stoneShape(g, x, y, s.rx, s.ry, s.rot, rr); const gr = g.createRadialGradient(x - s.rx * .3, y - s.ry * .3, 1, x, y, Math.max(s.rx, s.ry) * 1.1);
        gr.addColorStop(0, tone[0]); gr.addColorStop(1, tone[1]); g.fillStyle = gr; g.fill();
        g.strokeStyle = 'rgba(40,32,24,.35)'; g.lineWidth = 1.2; g.stroke();
        const rr2 = rng(seed); stoneShape(gh, x, y, s.rx, s.ry, s.rot, rr2); const hg = gh.createRadialGradient(x, y, 1, x, y, Math.max(s.rx, s.ry));
        hg.addColorStop(0, '#f0f0f0'); hg.addColorStop(.7, '#b8b8b8'); hg.addColorStop(1, '#707070'); gh.fillStyle = hg; gh.fill();
      }, s.x, s.y, Math.max(s.rx, s.ry) * 1.3);
    }
    noise(g, r, 5000, .07, 2);
  };
  if (mat === 'galets') { // galets roulés posés en arêtes de poisson, rangs alternés
    const list = [], rowH = 24;
    for (let row = 0; row < TEX / rowH; row++) { const dir = row % 2 ? 1 : -1; for (let x = 0; x < TEX; x += 13) list.push({ x: x + r() * 5, y: row * rowH + rowH / 2 + (r() - .5) * 4, rx: 12 + r() * 4, ry: 5.5 + r() * 2, rot: dir * (.75 + r() * .2) }); }
    stones(list, '#b9ab93', [['#cfc6b8', '#8e877c'], ['#bda98f', '#7d6a55'], ['#d8d3c9', '#9a948a'], ['#a89c8c', '#6b6258'], ['#c9b79a', '#8a7658']]);
  } else if (mat === 'pierre') { // moellons irréguliers, rangs approximatifs
    const list = []; let y = 0;
    while (y < TEX) { const h = 26 + r() * 22; let x = 0; while (x < TEX) { const w = 30 + r() * 50; list.push({ x: x + w / 2, y: y + h / 2 + (r() - .5) * 6, rx: w / 2 - 3, ry: h / 2 - 3, rot: (r() - .5) * .2 }); x += w + 2; } y += h + 2; }
    stones(list, '#a99b86', [['#c4b59c', '#8b7b63'], ['#b8aa92', '#7a6c58'], ['#cdbfa6', '#978468'], ['#a8987f', '#6f6250'], ['#bfb7a8', '#86806f']]);
  } else if (mat === 'pise') { // pisé enduit à la chaux : teinte ocre, marques des banchées, usure
    g.fillStyle = '#cdb28a'; g.fillRect(0, 0, TEX, TEX); gh.fillStyle = '#808080'; gh.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 60; i++) { const x = r() * TEX, y = r() * TEX, rad = 20 + r() * 70, gr = g.createRadialGradient(x, y, 0, x, y, rad); const c = r() < .5 ? '190,160,120' : '215,195,160'; gr.addColorStop(0, `rgba(${c},.35)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    for (let y = 0; y < TEX; y += TEX / 2.5) { g.fillStyle = 'rgba(90,70,45,.18)'; g.fillRect(0, y, TEX, 2); gh.fillStyle = '#606060'; gh.fillRect(0, y, TEX, 3); }
    noise(g, r, 9000, .08, 2); noise(gh, r, 9000, .25, 2);
  } else { // béton
    g.fillStyle = '#a7a59f'; g.fillRect(0, 0, TEX, TEX); gh.fillStyle = '#808080'; gh.fillRect(0, 0, TEX, TEX);
    for (let y = 0; y < TEX; y += TEX / 4) { g.fillStyle = 'rgba(60,60,60,.25)'; g.fillRect(0, y, TEX, 1.5); }
    noise(g, r, 12000, .09, 2); noise(gh, r, 12000, .2, 2);
  }
  const map = new THREE.CanvasTexture(cv), nrm = new THREE.CanvasTexture(normalFromHeight(hc, mat === 'galets' || mat === 'pierre' ? 4 : 1.5));
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, nrm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { map, nrm };
}
function material(mat) {
  if (cache[mat]) return cache[mat];
  const { map, nrm } = makeTex(mat);
  return (cache[mat] = new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(1, 1), roughness: .95, side: THREE.DoubleSide }));
}
const capMats = {
  tuile: new THREE.MeshStandardMaterial({ color: '#9c4f36', roughness: .85 }),
  dalle: new THREE.MeshStandardMaterial({ color: '#b3aa98', roughness: .9 }),
};

/* walls : [{ coords: [[lat, lon]…], height, kind, material }] ; toLocal(lat, lon) → {x, z} ; groundAt(x, z) → y */
export function buildWalls(walls, { toLocal, groundAt }) {
  const group = new THREE.Group();
  for (const w of walls) {
    const T = WALL_TYPES[w.kind] || WALL_TYPES.enceinte, H = clamp(+w.height || T.height, .3, 6), th = T.thick;
    const pts = w.coords.map(([la, lo]) => toLocal(la, lo));
    // échantillonnage tous les 1,5 m pour suivre le terrain
    const S = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 1.5));
      for (let k = i ? 1 : 0; k <= n; k++) S.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
    }
    if (S.length < 2) continue;
    // normales en chaque point (moyenne des segments voisins)
    const N = S.map((p, i) => { const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return { x: -dz / l, z: dx / l }; });
    const G = S.map(p => groundAt(p.x, p.z));
    let acc = 0; const U = S.map((p, i) => (acc += i ? Math.hypot(p.x - S[i - 1].x, p.z - S[i - 1].z) : 0));
    const pos = [], uv = [], idx = [], cap = [], capIdx = [];
    const quad = (P, Q, u0, u1, v0, v1) => { const b = pos.length / 3; pos.push(...P[0], ...P[1], ...Q[1], ...Q[0]); uv.push(u0, v0, u0, v1, u1, v1, u1, v0); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); };
    const TX = 2; // mètres par motif de texture
    for (const side of [1, -1]) for (let i = 0; i < S.length - 1; i++) {
      const o = th / 2 * side, p = S[i], q = S[i + 1], np = N[i], nq = N[i + 1];
      const bot = Math.min(G[i], G[i + 1]) - .4;
      const P = [[p.x + np.x * o, bot, p.z + np.z * o], [p.x + np.x * o, G[i] + H, p.z + np.z * o]], Q = [[q.x + nq.x * o, bot, q.z + nq.z * o], [q.x + nq.x * o, G[i + 1] + H, q.z + nq.z * o]];
      if (side < 0) quad(Q, P, U[i + 1] / TX, U[i] / TX, (bot - G[i]) / TX, H / TX); else quad(P, Q, U[i] / TX, U[i + 1] / TX, (bot - G[i]) / TX, H / TX);
    }
    // extrémités
    for (const i of [0, S.length - 1]) {
      const p = S[i], n = N[i], a = [p.x + n.x * th / 2, p.z + n.z * th / 2], b = [p.x - n.x * th / 2, p.z - n.z * th / 2], bot = G[i] - .4;
      const P = [[a[0], bot, a[1]], [a[0], G[i] + H, a[1]]], Q = [[b[0], bot, b[1]], [b[0], G[i] + H, b[1]]];
      i ? quad(P, Q, 0, th / TX, 0, (H + .4) / TX) : quad(Q, P, 0, th / TX, 0, (H + .4) / TX);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material(w.material || 'pierre')); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    // Chaperon : tuiles sur un mur d'enceinte, dalle sur un muret
    const tile = (w.kind || 'enceinte') === 'enceinte', cw = th / 2 + .06, ch = tile ? .16 : .08;
    for (let i = 0; i < S.length - 1; i++) {
      const p = S[i], q = S[i + 1], np = N[i], nq = N[i + 1], y0 = G[i] + H, y1 = G[i + 1] + H, b = cap.length / 3;
      cap.push(p.x + np.x * cw, y0, p.z + np.z * cw, p.x, y0 + ch, p.z, p.x - np.x * cw, y0, p.z - np.z * cw,
        q.x + nq.x * cw, y1, q.z + nq.z * cw, q.x, y1 + ch, q.z, q.x - nq.x * cw, y1, q.z - nq.z * cw);
      if (!tile) { cap[b * 3 + 4] = y0 + ch; cap[b * 3 + 13] = y1 + ch; cap[b * 3 + 1] = y0 + ch; cap[b * 3 + 7] = y0 + ch; cap[b * 3 + 10] = y1 + ch; cap[b * 3 + 16] = y1 + ch; }
      capIdx.push(b, b + 1, b + 3, b + 1, b + 4, b + 3, b + 1, b + 2, b + 4, b + 2, b + 5, b + 4);
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3)); cg.setIndex(capIdx); cg.computeVertexNormals();
    const cm = new THREE.Mesh(cg, (tile ? capMats.tuile : capMats.dalle)); cm.material.side = THREE.DoubleSide; cm.castShadow = true; group.add(cm);
  }
  return group;
}
