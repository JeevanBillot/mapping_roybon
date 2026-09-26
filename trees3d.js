/* Arbres détaillés : silhouette propre à l'espèce, feuillage en grappes de feuilles dessinées selon l'espèce,
   écorce texturée, couleurs et écorce reprises des photos prises sur le terrain. Module ES. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = seed => { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; s = s || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Feuilles (gris clair, teintées par la couleur de l'arbre) ----------
function leafPath(g, kind, r) {
  g.beginPath();
  const polar = f => { for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, rr = f(a); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } };
  if (kind === 'palmate') polar(a => .55 + .45 * Math.pow(Math.abs(Math.cos(2.5 * (a + Math.PI / 2))), .7));
  else if (kind === 'lobed') { g.moveTo(0, -1); for (let i = 0; i <= 20; i++) { const y = -1 + i / 10, w = .42 * Math.sin(Math.PI * (i / 20)) * (.72 + .28 * Math.cos(i * 1.9)); g.lineTo(w, y); } for (let i = 20; i >= 0; i--) { const y = -1 + i / 10, w = .42 * Math.sin(Math.PI * (i / 20)) * (.72 + .28 * Math.cos(i * 1.9)); g.lineTo(-w, y); } }
  else if (kind === 'fan') { g.moveTo(0, .9); g.lineTo(-.7, -.35); g.quadraticCurveTo(-.35, -.85, -.04, -.55); g.lineTo(0, -.35); g.lineTo(.04, -.55); g.quadraticCurveTo(.35, -.85, .7, -.35); g.closePath(); }
  else if (kind === 'lanceolate') { g.moveTo(0, -1); g.quadraticCurveTo(.3, 0, 0, 1); g.quadraticCurveTo(-.3, 0, 0, -1); }
  else if (kind === 'cordate') { g.moveTo(0, -1); g.bezierCurveTo(.6, -.5, .85, .45, .2, .85); g.quadraticCurveTo(0, .6, -.2, .85); g.bezierCurveTo(-.85, .45, -.6, -.5, 0, -1); }
  else if (kind === 'round') polar(a => .78 + .05 * Math.sin(a * 18));
  else { g.moveTo(0, -1); g.bezierCurveTo(.55, -.45, .5, .55, 0, 1); g.bezierCurveTo(-.5, .55, -.55, -.45, 0, -1); } // ovale
  g.closePath();
}
const leafCache = {};
export function leafTexture(kind, renderer) {
  if (leafCache[kind]) return leafCache[kind];
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), r = rng(kind);
  const needle = kind === 'needle' || kind === 'scale';
  // brindilles
  g.strokeStyle = 'rgb(120,110,95)'; g.lineWidth = needle ? 2.5 : 2;
  const twigs = []; for (let i = 0; i < (needle ? 8 : 5); i++) { const a = r() * Math.PI * 2, x0 = S / 2 + (r() - .5) * 30, y0 = S / 2 + (r() - .5) * 30, L = S * (.28 + r() * .16); twigs.push([x0, y0, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); g.stroke(); }
  if (kind === 'needle') { // aiguilles de part et d'autre des rameaux
    for (const [x0, y0, x1, y1] of twigs) for (let k = 0; k < 46; k++) {
      const f = k / 34, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, a = Math.atan2(y1 - y0, x1 - x0) + (k % 2 ? 1 : -1) * (.9 + r() * .3), L = 12 + r() * 9, v = 175 + r() * 80;
      g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
  } else if (kind === 'scale') { // touffes courtes (cèdre, thuya)
    for (let k = 0; k < 120; k++) {
      const tw = twigs[k % twigs.length], f = r(), cx = tw[0] + (tw[2] - tw[0]) * f + (r() - .5) * 18, cy = tw[1] + (tw[3] - tw[1]) * f + (r() - .5) * 18, v = 200 + r() * 55;
      g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1.6;
      for (let j = 0; j < 12; j++) { const a = j / 12 * Math.PI * 2 + r() * .3, L = 6 + r() * 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.stroke(); }
    }
  } else { // feuilles
    const n = kind === 'round' || kind === 'lanceolate' ? 46 : 36, size = { palmate: 34, lobed: 34, fan: 30, cordate: 30, ovate: 28, round: 24, lanceolate: 32 }[kind] || 28;
    for (let k = 0; k < n; k++) {
      const tw = twigs[k % twigs.length], f = .1 + r() * .9, x = tw[0] + (tw[2] - tw[0]) * f + (r() - .5) * 40, y = tw[1] + (tw[3] - tw[1]) * f + (r() - .5) * 40;
      const v = 205 + r() * 50, s = size * (.75 + r() * .45);
      g.save(); g.translate(x, y); g.rotate(r() * Math.PI * 2); g.scale(s, s);
      leafPath(g, kind, r); g.fillStyle = `rgb(${v},${v},${v * .97})`; g.fill();
      g.strokeStyle = `rgba(90,90,80,.35)`; g.lineWidth = .06; g.beginPath(); g.moveTo(0, -.9); g.lineTo(0, .9); g.stroke();
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
  return (leafCache[kind] = t);
}

// ---------- Écorces ----------
const barkCache = {};
export function barkTexture(kind, renderer) {
  if (barkCache[kind]) return barkCache[kind];
  const W = 256, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), r = rng('bark' + kind);
  const base = { smooth: '#8e8a82', furrowed: '#5d5046', plates: '#7a624d', birch: '#e8e4da', fibrous: '#7c5236', ridged: '#6e665a' }[kind] || '#6a5a4a';
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < .5 ? `rgba(255,255,255,${r() * .06})` : `rgba(0,0,0,${r() * .08})`; g.fillRect(r() * W, r() * H, 2 + r() * 10, 2 + r() * 14); }
  if (kind === 'furrowed' || kind === 'fibrous' || kind === 'ridged') {
    const n = kind === 'fibrous' ? 34 : 14;
    for (let i = 0; i < n; i++) {
      let x = r() * W; g.strokeStyle = kind === 'fibrous' ? `rgba(40,20,10,${.25 + r() * .3})` : `rgba(20,15,10,${.45 + r() * .3})`; g.lineWidth = kind === 'fibrous' ? 1.5 + r() * 2 : 3 + r() * 5;
      g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= H; y += 16) { x += (r() - .5) * (kind === 'ridged' ? 22 : 10); g.lineTo(((x % W) + W) % W, y); } g.stroke();
    }
  } else if (kind === 'plates') {
    for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * H, w = 18 + r() * 40, h = 20 + r() * 50, v = r(); g.fillStyle = v < .5 ? `rgba(160,130,100,${.25 + r() * .3})` : `rgba(40,30,20,${.2 + r() * .3})`; g.beginPath(); g.ellipse(x, y, w / 2, h / 2, r(), 0, Math.PI * 2); g.fill(); }
  } else if (kind === 'birch') {
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(30,25,20,${.5 + r() * .4})`; g.fillRect(r() * W, r() * H, 10 + r() * 40, 2 + r() * 3); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(40,35,30,.55)'; g.beginPath(); g.ellipse(r() * W, r() * H, 6 + r() * 18, 4 + r() * 10, 0, 0, Math.PI * 2); g.fill(); }
  } else { // lisse : lenticelles horizontales
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(60,55,50,${.2 + r() * .25})`; g.fillRect(r() * W, r() * H, 4 + r() * 10, 1.5); }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
  return (barkCache[kind] = t);
}

// ---------- D'après les photos du terrain ----------
const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
/* Couleur dominante du feuillage (pixels verts et moyennement lumineux). */
export async function photoFoliageColor(url) {
  try {
    const im = await loadImg(url), S = 72, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
    g.drawImage(im, 0, 0, S, S); const d = g.getImageData(0, 0, S, S).data; let R = 0, G = 0, B = 0, n = 0;
    for (let k = 0; k < d.length; k += 4) {
      const r = d[k] / 255, gg = d[k + 1] / 255, b = d[k + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx, s = mx ? (mx - mn) / mx : 0;
      if (s < .18 || v < .12 || v > .92 || mx !== gg && !(gg > r * .95 && gg > b)) continue; // teintes vertes
      let h = mx === mn ? 0 : mx === r ? 60 * (((gg - b) / (mx - mn)) % 6) : mx === gg ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - gg) / (mx - mn) + 4); if (h < 0) h += 360;
      if (h < 45 || h > 170) continue;
      R += r * r; G += gg * gg; B += b * b; n++;
    }
    if (n < 40) return null;
    return new THREE.Color().setRGB(Math.sqrt(R / n), Math.sqrt(G / n), Math.sqrt(B / n), THREE.SRGBColorSpace);
  } catch (e) { return null; }
}
/* Texture d'écorce tirée de la photo (partie centrale, répétée en miroir pour masquer les raccords). */
export async function photoBarkTexture(url, renderer) {
  try {
    const im = await loadImg(url), side = Math.min(im.width, im.height) * .6, S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    cv.getContext('2d').drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, S, S);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    return t;
  } catch (e) { return null; }
}

// Évite les feuillages trop sombres (luminosité mini)
function lift(c) { const hsl = {}; c.getHSL(hsl, THREE.SRGBColorSpace); if (hsl.l < .3) c.setHSL(hsl.h, Math.min(hsl.s, .6), .3, THREE.SRGBColorSpace); return c; }

// ---------- Silhouettes par port ----------
/* Renvoie les grappes de feuillage { p: position (m), s: taille (m), droop } et les branches [a, b, r0, r1]. */
function layout(form, h, rad, r) {
  const C = [], B = [], V = (x, y, z) => new THREE.Vector3(x, y, z);
  const shell = (cy, rx, ry, n, inner = .72, size = 1) => { n = Math.round(n * 1.5); for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, k = inner + (1 - inner) * Math.sqrt(r()), sq = Math.sqrt(1 - u * u); C.push({ p: V(Math.cos(a) * sq * rx * k, cy + u * ry * k, Math.sin(a) * sq * rx * k), s: size * (.8 + r() * .6) }); }
    // remplissage intérieur : évite les trous sans boule sombre
    for (let i = 0, m = Math.round(n * .3); i < m; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, k = .2 + r() * (inner - .2), sq = Math.sqrt(1 - u * u); C.push({ p: V(Math.cos(a) * sq * rx * k, cy + u * ry * k, Math.sin(a) * sq * rx * k), s: size * (1 + r() * .5) }); } };
  const scaffolds = (y0, n, spread, rise, len) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r() * .6, L = len * (.7 + r() * .4); B.push([V(0, y0, 0), V(Math.cos(a) * L * spread, y0 + L * rise, Math.sin(a) * L * spread), .35, .12]); } };
  const cs = clamp(rad * .42, .9, 2.2); // taille d'une grappe
  switch (form) {
    case 'cedar': { // plateaux horizontaux étagés
      const tiers = 5 + Math.round(r() * 2), y0 = h * .12;
      for (let t = 0; t < tiers; t++) {
        const f = t / (tiers - 1), y = y0 + (h - y0 - 1.5) * f, pr = rad * (1 - f * .55) * (.85 + r() * .3), a0 = r() * 6.28;
        B.push([V(0, y, 0), V(Math.cos(a0) * pr * .8, y + .6, Math.sin(a0) * pr * .8), .25, .08], [V(0, y, 0), V(-Math.cos(a0) * pr * .7, y + .5, -Math.sin(a0) * pr * .7), .22, .07]);
        const n = Math.round(22 + pr * 6);
        for (let i = 0; i < n; i++) { const a = r() * 6.28, d = pr * Math.sqrt(r()); C.push({ p: V(Math.cos(a) * d, y + .3 + r() * .6 - d / pr * .4, Math.sin(a) * d), s: cs * 1.1, flat: true }); }
      }
      break;
    }
    case 'spruce': case 'fir': { // cône d'étages ; branches tombantes (épicéa) ou relevées (sapin)
      const y0 = h * .05, levels = Math.max(8, Math.round((h - y0) / .9));
      for (let l = 0; l < levels; l++) {
        const f = l / levels, y = y0 + (h - y0) * f, pr = rad * Math.pow(1 - f, .95) + .25, n = Math.round(6 + pr * 5);
        for (let i = 0; i < n; i++) { const a = i / n * 6.28 + r() * .5, d = pr * (.55 + r() * .45); C.push({ p: V(Math.cos(a) * d, y + (form === 'spruce' ? -d * .25 : d * .08), Math.sin(a) * d), s: cs * (.7 + (1 - f) * .5), droop: form === 'spruce' ? .5 : -.2 }); }
      }
      break;
    }
    case 'pine': { scaffolds(h * .62, 5, .7, .45, rad); shell(h * .8, rad, h * .13, Math.round(60 + rad * 12), .5, 1.1); break; }
    case 'columnar': shell(h * .55, rad, h * .45, Math.round(80 + h * 6), .6, .9); break;
    case 'weeping': {
      shell(h * .62, rad * .85, h * .3, 70, .6);
      for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28 + r() * .2; for (let k = 0; k < 5; k++) C.push({ p: V(Math.cos(a) * rad * (.8 + k * .04), h * (.75 - k * .13), Math.sin(a) * rad * (.8 + k * .04)), s: cs * .9, hang: true }); }
      scaffolds(h * .45, 5, .8, .5, rad * .9); break;
    }
    case 'birch': { // port léger, clairsemé, rameaux retombants
      scaffolds(h * .35, 6, .55, .9, h * .35);
      shell(h * .62, rad, h * .36, Math.round(55 + h * 2), .45, .8); break;
    }
    case 'ginkgo': { // charpentières dressées, port irrégulier et aéré
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 6.28 + r(), tilt = .25 + r() * .3, L = h * (.45 + r() * .2), y0 = h * (.25 + r() * .15), end = V(Math.cos(a) * L * tilt, y0 + L, Math.sin(a) * L * tilt);
        B.push([V(0, y0, 0), end, .28, .08]);
        for (let k = 0; k < 16; k++) { const f = .3 + r() * .75; C.push({ p: V(end.x * f + (r() - .5) * rad * .5, y0 + (end.y - y0) * f + (r() - .5) * 1.2, end.z * f + (r() - .5) * rad * .5), s: cs * .9 }); }
      }
      break;
    }
    case 'multistem': { // cépée : plusieurs brins depuis le sol
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + r() * .5, lean = rad * (.45 + r() * .3); B.push([V(Math.cos(a) * .15, 0, Math.sin(a) * .15), V(Math.cos(a) * lean, h * (.8 + r() * .15), Math.sin(a) * lean), .09, .04]); }
      shell(h * .6, rad, h * .42, Math.round(60 + rad * 14), .55); break;
    }
    case 'dense': shell(h * .5, rad, h * .5, Math.round(90 + rad * 20), .7, .9); break;
    case 'ovoid': scaffolds(h * .3, 4, .45, .8, h * .3); shell(h * .6, rad, h * .4, Math.round(90 + rad * 14), .7); break;
    default: scaffolds(h * .32, 5, .6, .6, rad * .9); shell(h * .64, rad, h * .34, Math.round(90 + rad * 14), .7); // feuillu étalé
  }
  return { C, B };
}

// Tronc ou branche : cylindre orienté entre deux points
function limb(a, b, r0, r1) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, 8, 1, true);
  g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len / 1.2); // écorce à l'échelle
  return g;
}

function windify(mat, U, amp) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 wp = vec3(modelMatrix[3]); float ph = wp.x * .21 + wp.z * .17;
      float sw = (sin(uTime * 1.3 + ph) * .6 + sin(uTime * 2.1 + ph * 1.7) * .4) * ${amp.toFixed(4)} * max(0., transformed.y);
      float fl = sin(uTime * 7. + position.x * 3.1 + position.z * 2.3) * .025;
      transformed.x += sw + fl; transformed.z += sw * .6 + fl;`);
    sh.fragmentShader = sh.fragmentShader.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;');
  };
  return mat;
}

/* Construit l'arbre détaillé. h : hauteur (m), rad : rayon de couronne (m). */
export function buildDetailedTree({ tr, h, rad, seed, U, renderer, lite = false }) {
  const r = rng(seed), group = new THREE.Group(), form = tr.form || 'broad';
  const { C, B } = layout(form, h, rad, r);
  // Tronc principal
  const conifer = ['cedar', 'spruce', 'fir', 'columnar'].includes(form), trunkTop = conifer ? h * .95 : form === 'multistem' ? 0 : form === 'pine' ? h * .7 : h * .55;
  const r0 = clamp(.08 + h * .016, .1, .8), geos = [];
  if (trunkTop > 0) geos.push(limb(new THREE.Vector3(0, -.2, 0), new THREE.Vector3(0, trunkTop, 0), r0, r0 * .35));
  for (const [a, b, f0, f1] of B) geos.push(limb(a, b, Math.max(.04, r0 * f0 * 1.3), Math.max(.025, r0 * f1 * 1.3)));
  const barkMat = new THREE.MeshStandardMaterial({ map: barkTexture(tr.bark || 'furrowed', renderer), roughness: 1 });
  barkMat.map = barkMat.map.clone(); barkMat.map.needsUpdate = true; barkMat.map.repeat.set(1.5, 1);
  const trunk = new THREE.Mesh(mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g)), barkMat); trunk.castShadow = true; group.add(trunk);
  // Feuillage : grappes = 2 plans croisés texturés, normales orientées vers l'extérieur de la couronne (volume doux)
  const clusters = lite ? C.filter((_, i) => i % 2 === 0) : C;
  const P = [], N = [], UV = [], COL = [], center = new THREE.Vector3(0, form === 'cedar' ? h * .5 : h * .62, 0);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), tmp = new THREE.Vector3(), nrm = new THREE.Vector3();
  const quad = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, -.5], [.5, .5], [-.5, .5]], uvq = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
  for (const c of clusters) {
    nrm.copy(c.p).sub(center); nrm.y *= .6; nrm.normalize().lerp(new THREE.Vector3(0, 1, 0), .25).normalize();
    const shade = clamp(.8 + .4 * (c.p.y / h) + .12 * nrm.y + (r() - .5) * .16, .65, 1.3);
    for (let k = 0; k < 2; k++) {
      if (c.flat) e.set(k ? -.35 + (r() - .5) * .4 : -Math.PI / 2 + (r() - .5) * .5, r() * 6.28, 0);
      else if (c.hang) e.set((r() - .5) * .3, r() * 6.28, 0);
      else e.set((r() - .5) * 1.2 + (c.droop || 0), k * Math.PI / 2 + r() * 6.28, (r() - .5) * .6);
      q.setFromEuler(e);
      const sx = c.s * (c.hang ? .6 : 1), sy = c.s * (c.hang ? 1.8 : 1);
      for (let v = 0; v < 6; v++) {
        tmp.set(quad[v][0] * sx, quad[v][1] * sy, 0).applyQuaternion(q).add(c.p);
        P.push(tmp.x, tmp.y, tmp.z); N.push(nrm.x, nrm.y, nrm.z); UV.push(uvq[v][0], uvq[v][1]); COL.push(shade, shade, shade);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  lg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); lg.setAttribute('color', new THREE.Float32BufferAttribute(COL, 3));
  const tex = leafTexture(tr.leaf || 'ovate', renderer);
  const leafMat = windify(new THREE.MeshStandardMaterial({ map: tex, color: lift(new THREE.Color(tr.color)), vertexColors: true, alphaTest: .45, side: THREE.DoubleSide, roughness: .8 }), U, .012);
  leafMat.emissive = leafMat.color.clone().multiplyScalar(.22); // lumière diffuse traversant le feuillage (évite les feuilles noires à l'ombre)
  const leaves = new THREE.Mesh(lg, leafMat); leaves.castShadow = true; leaves.receiveShadow = true;
  leaves.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .45 });
  group.add(leaves);
  // Cœur sombre qui comble les trous du feuillage (sauf ports clairsemés)
  if (['spruce', 'fir', 'columnar'].includes(form)) {
    const ry = form === 'spruce' || form === 'fir' ? (h - h * .05) / 2 : form === 'columnar' ? h * .4 : form === 'pine' ? h * .1 : form === 'dense' || form === 'multistem' ? h * .38 : h * .28;
    const cy = form === 'spruce' || form === 'fir' ? h * .45 : form === 'pine' ? h * .8 : form === 'dense' ? h * .5 : h * .62;
    const coreGeo = form === 'spruce' || form === 'fir' ? new THREE.ConeGeometry(rad * .62, h * .88, 10).translate(0, h * .5, 0) : new THREE.IcosahedronGeometry(1, 2).scale(rad * .58, ry * .72, rad * .58).translate(0, cy, 0);
    const core = new THREE.Mesh(coreGeo, windify(new THREE.MeshStandardMaterial({ color: new THREE.Color(tr.color).multiplyScalar(.72), roughness: 1, flatShading: true }), U, .012));
    core.castShadow = true; group.add(core); group.userData.core = core;
  }
  return {
    group, leafMat, barkMat,
    setFoliageColor(c) { const base = new THREE.Color(tr.color); leafMat.color.copy(lift(base.lerp(c, .7))); leafMat.emissive.copy(leafMat.color).multiplyScalar(.22); if (group.userData.core) group.userData.core.material.color.copy(leafMat.color).multiplyScalar(.72); },
    setBark(t) { t.repeat.set(1.5, 1); barkMat.map = t; barkMat.needsUpdate = true; },
  };
}
