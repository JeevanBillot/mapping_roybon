/* Maison principale : façade dessinée d'après les photos (enduit beige, soubassement, fenêtres cintrées,
   volets gris-lavande), porte d'entrée vitrée, terrasse surélevée à balustres et escalier. Module ES. */
import * as THREE from 'three';

export const BAY = 3.3;          // largeur d'une travée (m)
export const FACADE_H = 8.6;     // hauteur dessinée de la façade (m)
const CM = 100;                  // 1 px = 1 cm
const RENDER = '#e5d2b4', PLINTH = '#cfc7b6', STONE = '#e9dec8', SHUTTER = '#b9c0d7', SHUTTER_LINE = '#a3abc4', FRAME = '#a7afc3';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function mottle(g, x, y, w, h, r, n = 260) {
  for (let i = 0; i < n; i++) {
    const cx = x + r() * w, cy = y + r() * h, rx = 8 + r() * 40, ry = 6 + r() * 26;
    g.fillStyle = r() < .5 ? `rgba(255,248,235,${.025 + r() * .035})` : `rgba(120,100,70,${.015 + r() * .03})`;
    g.beginPath(); g.ellipse(cx, cy, rx, ry, r() * 3, 0, Math.PI * 2); g.fill();
  }
}
// Ouverture à linteau cintré (arc surbaissé)
function archPath(g, cx, w, yTop, yBot, rise) {
  g.beginPath(); g.moveTo(cx - w / 2, yBot); g.lineTo(cx - w / 2, yTop + rise);
  g.quadraticCurveTo(cx, yTop - rise, cx + w / 2, yTop + rise); g.lineTo(cx + w / 2, yBot); g.closePath();
}
function windowAt(g, cx, w, yTop, yBot, rise, rows) {
  g.fillStyle = STONE; archPath(g, cx, w + 18, yTop - 9, yBot + 6, rise); g.fill();                         // encadrement pierre
  const glass = g.createLinearGradient(0, yTop, 0, yBot); glass.addColorStop(0, '#7d8a97'); glass.addColorStop(.45, '#3e4853'); glass.addColorStop(1, '#56616c');
  g.fillStyle = glass; archPath(g, cx, w, yTop, yBot, rise); g.fill();
  g.strokeStyle = FRAME; g.lineWidth = 6; archPath(g, cx, w, yTop, yBot, rise); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(cx, yTop); g.lineTo(cx, yBot);
  for (let k = 1; k < rows; k++) { const y = yTop + rise + (yBot - yTop - rise) * k / rows; g.moveTo(cx - w / 2, y); g.lineTo(cx + w / 2, y); }
  g.stroke();
}
function shutter(g, x, w, yTop, yBot, rise, r) {
  g.fillStyle = SHUTTER; g.fillRect(x, yTop + rise * .6, w, yBot - yTop - rise * .6);
  g.strokeStyle = SHUTTER_LINE; g.lineWidth = 1.5;
  for (let px = x + 10; px < x + w - 3; px += 11) { g.beginPath(); g.moveTo(px, yTop + rise * .6 + 3); g.lineTo(px, yBot - 3); g.stroke(); }
  g.lineWidth = 4; g.strokeStyle = '#aab2ca';
  for (let k = 1; k <= 3; k++) { const y = yTop + (yBot - yTop) * (k / 4); g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + w - 3, y); g.stroke(); }
  g.strokeStyle = '#98a0b8'; g.lineWidth = 2; g.strokeRect(x + 1, yTop + rise * .6 + 1, w - 2, yBot - yTop - rise * .6 - 2);
  g.fillStyle = `rgba(255,255,255,${.05 + r() * .06})`; g.fillRect(x + 2, yTop + rise, w * .4, yBot - yTop - rise - 4); // usure
}

/* Travée type (3,3 m × 8,6 m) répétée le long des murs de la maison. */
export function facadeTexture(renderer) {
  const W = BAY * CM, H = FACADE_H * CM, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), r = rng(7), Y = h => H - h * CM;
  g.fillStyle = RENDER; g.fillRect(0, 0, W, H); mottle(g, 0, 0, W, H, r, 420);
  g.fillStyle = PLINTH; g.fillRect(0, Y(1.3), W, 1.3 * CM); mottle(g, 0, Y(1.3), W, 1.3 * CM, r, 60);
  g.fillStyle = '#bcb4a2'; g.fillRect(0, Y(1.3) - 2, W, 3);
  // Rez-de-chaussée : porte-fenêtre cintrée, volets ouverts
  const cx = W / 2, gw = 124, gT = Y(3.95), gB = Y(1.45);
  shutter(g, cx - gw / 2 - 12 - 58, 58, gT, gB, 10, r); shutter(g, cx + gw / 2 + 12, 58, gT, gB, 10, r);
  windowAt(g, cx, gw, gT, gB, 14, 3);
  g.fillStyle = '#d9cdb5'; g.fillRect(cx - gw / 2 - 10, gB + 4, gw + 20, 7);                                 // appui
  // Étage : fenêtre, volets ouverts
  const fw = 108, fT = Y(7.3), fB = Y(5.35);
  shutter(g, cx - fw / 2 - 11 - 52, 52, fT, fB, 6, r); shutter(g, cx + fw / 2 + 11, 52, fT, fB, 6, r);
  windowAt(g, cx, fw, fT, fB, 8, 3);
  g.fillStyle = '#d9cdb5'; g.fillRect(cx - fw / 2 - 8, fB + 3, fw + 16, 6);
  // Ombre portée de l'avant-toit en haut du mur
  const sh = g.createLinearGradient(0, 0, 0, 40); sh.addColorStop(0, 'rgba(60,45,30,.45)'); sh.addColorStop(1, 'rgba(60,45,30,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, 40);
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

/* Porte d'entrée (vantaux bois vitrés à ferronnerie, imposte cintrée), vue de la terrasse : 3,3 m × 3,0 m. */
export function doorTexture(renderer) {
  const W = BAY * CM, H = 300, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), r = rng(11), cx = W / 2, dw = 150, dT = 35, dB = H - 12;
  g.fillStyle = RENDER; g.fillRect(0, 0, W, H); mottle(g, 0, 0, W, H, r, 140);
  shutter(g, cx - dw / 2 - 14 - 58, 58, dT + 20, dB, 8, r); shutter(g, cx + dw / 2 + 14, 58, dT + 20, dB, 8, r);
  g.fillStyle = STONE; archPath(g, cx, dw + 22, dT - 10, dB + 4, 16); g.fill();
  g.fillStyle = '#6f4326'; archPath(g, cx, dw, dT, dB, 16); g.fill();                                        // bois
  const tr = dT + 62;                                                                                         // imposte vitrée
  g.fillStyle = '#566270'; archPath(g, cx, dw - 16, dT + 8, tr, 14); g.fill();
  g.strokeStyle = '#3a2a1c'; g.lineWidth = 3; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx + k * 14, tr); g.lineTo(cx + k * 22, dT + 12); g.stroke(); }
  g.fillStyle = '#5a3620'; g.fillRect(cx - dw / 2 + 4, tr, dw - 8, 6);
  for (const s of [-1, 1]) {                                                                                  // deux vantaux
    const x0 = s < 0 ? cx - dw / 2 + 10 : cx + 5, w = dw / 2 - 15, y0 = tr + 16, y1 = dB - 42;
    g.fillStyle = '#4c5864'; g.fillRect(x0, y0, w, y1 - y0);
    g.strokeStyle = '#2d241c'; g.lineWidth = 2.2;                                                              // ferronnerie en volutes
    for (let k = 0; k < 4; k++) { const yy = y0 + 18 + k * (y1 - y0 - 30) / 3; g.beginPath(); g.arc(x0 + w / 2 - 9, yy, 9, 0, Math.PI * 1.6); g.stroke(); g.beginPath(); g.arc(x0 + w / 2 + 9, yy, 9, Math.PI, Math.PI * 2.6); g.stroke(); }
    g.beginPath(); g.moveTo(x0 + w / 2, y0); g.lineTo(x0 + w / 2, y1); g.stroke();
    g.fillStyle = '#7b4a2b'; g.fillRect(x0, y1 + 8, w, dB - y1 - 14);                                          // panneau bas
    g.strokeStyle = '#5a3620'; g.lineWidth = 2; g.strokeRect(x0 + 5, y1 + 13, w - 10, dB - y1 - 24);
  }
  g.fillStyle = '#c9a15a'; g.fillRect(cx - 3, (tr + dB) / 2, 6, 14);                                          // poignée
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

/* Terrasse surélevée contre la façade : soubassement enduit, dalle, balustrade à balustres et piliers,
   escalier le long de la façade avec pilier en bas. Repère local : x le long du mur, z vers l'extérieur. */
export function buildTerrace({ A, d, n, g0, tStart, bays = 3, depth = 3.4, height = 1.3, door = true, renderer }) {
  const grp = new THREE.Group(); grp.matrixAutoUpdate = false;
  grp.matrix.makeBasis(new THREE.Vector3(d.x, 0, d.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n.x, 0, n.z)).setPosition(A.x, 0, A.z);
  const stone = new THREE.MeshStandardMaterial({ color: '#eadfca', roughness: .85 }), render = new THREE.MeshStandardMaterial({ color: '#d7d0c0', roughness: .95 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
  const L = bays * BAY, t0 = tStart, t1 = tStart + L, top = g0 + height, D = depth;
  add(new THREE.BoxGeometry(L, height + .6, D), render, (t0 + t1) / 2, g0 + (height - .6) / 2, D / 2);          // soubassement
  add(new THREE.BoxGeometry(L + .12, .14, D + .1), stone, (t0 + t1) / 2, top + .07, D / 2 + .03);                 // dalle
  for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(.3, .3, .02), new THREE.MeshStandardMaterial({ color: '#555' }), t0 + L * (k + .5) / 4, g0 + .75, D + .005); // grilles d'aération
  // Balustrade
  const y0 = top + .14, prof = [[.07, 0], [.07, .04], [.05, .06], [.045, .12], [.075, .25], [.08, .33], [.06, .42], [.04, .5], [.045, .55], [.07, .58], [.07, .62]].map(([r, y]) => new THREE.Vector2(r, y));
  const balGeo = new THREE.LatheGeometry(prof, 10), posts = [];
  const run = (xa, za, xb, zb) => {
    const len = Math.hypot(xb - xa, zb - za), ang = Math.atan2(zb - za, xb - xa), nP = Math.max(1, Math.round(len / 2.4));
    const rail = (h, w, y) => { const m = add(new THREE.BoxGeometry(len, h, w), stone, (xa + xb) / 2, y, (za + zb) / 2); m.rotation.y = -ang; };
    rail(.12, .26, y0 + .06); rail(.16, .3, y0 + .82);
    for (let i = 0; i <= nP; i++) { const f = i / nP; add(new THREE.BoxGeometry(.34, .96, .34), stone, xa + (xb - xa) * f, y0 + .48, za + (zb - za) * f); }
    for (let s = .3; s < len - .2; s += .21) {
      const f = s / len, seg = f * nP; if (Math.abs(seg - Math.round(seg)) * len / nP < .28) continue;           // pas de balustre contre un pilier
      posts.push([xa + (xb - xa) * f, za + (zb - za) * f]);
    }
  };
  const e = .17;
  run(t0 + e, D - e, t1 - e, D - e);          // façade de la terrasse
  run(t0 + e, .25, t0 + e, D - e);            // côté gauche
  run(t1 - e, D - e, t1 - e, 1.65);           // côté droit, ouverture vers l'escalier
  const inst = new THREE.InstancedMesh(balGeo, stone, posts.length), mtx = new THREE.Matrix4();
  posts.forEach(([x, z], i) => inst.setMatrixAt(i, mtx.makeTranslation(x, y0 + .12, z))); inst.castShadow = inst.receiveShadow = true; grp.add(inst);
  // Escalier le long de la façade, qui descend vers la droite
  const N = 8, riser = height / (N + 1), tread = .3, W = 1.45;
  for (let i = 0; i < N; i++) { const h = height - (i + 1) * riser, tx = t1 + i * tread + tread / 2; add(new THREE.BoxGeometry(tread, h + .3, W), stone, tx, g0 + (h - .3) / 2, .05 + W / 2); }
  const stairEnd = t1 + N * tread;
  add(new THREE.BoxGeometry(.38, 1.0, .38), stone, stairEnd - .1, g0 + .5, W + .2);                            // pilier en bas de l'escalier
  add(new THREE.BoxGeometry(.46, .08, .46), stone, stairEnd - .1, g0 + 1.04, W + .2);
  const limon = add(new THREE.BoxGeometry(N * tread + .3, .22, .2), stone, t1 + N * tread / 2 - .1, g0 + height / 2 + .35, W + .2); // rampe maçonnée
  limon.rotation.z = -Math.atan2(height, N * tread);
  // Porte d'entrée sur la terrasse (travée de droite)
  if (door) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(BAY, 3.0), new THREE.MeshStandardMaterial({ map: doorTexture(renderer), roughness: .85 }));
    plane.position.set(t1 - BAY / 2, top + 1.5, .045); plane.receiveShadow = true; grp.add(plane);
  }
  grp.updateMatrixWorld(true);
  return grp;
}

/* Avant-toit : débord de 0,55 m, sous-face bois, gouttière grise (le long des murs à hauteur constante). */
export function buildEave(a, c, n, ya, yc = ya) {
  const len = Math.hypot(c.x - a.x, c.z - a.z), ang = Math.atan2(c.z - a.z, c.x - a.x), grp = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(len + .7, .12, .6), new THREE.MeshStandardMaterial({ color: '#6d5343', roughness: .9 }));
  board.position.set(0, 0, .28); board.castShadow = true; grp.add(board);
  const gutter = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, len + .7, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#9ea3a6', roughness: .45, metalness: .5 }));
  gutter.position.set(0, -.02, .62); grp.add(gutter);
  grp.position.set((a.x + c.x) / 2, (ya + yc) / 2, (a.z + c.z) / 2); grp.rotation.order = 'YZX'; grp.rotation.y = -ang; grp.rotation.z = Math.atan2(yc - ya, len);
  // orienter le débord vers l'extérieur
  const lz = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -ang); if (lz.x * n.x + lz.z * n.z < 0) { grp.rotation.y += Math.PI; grp.rotation.z = -grp.rotation.z; }
  return grp;
}
