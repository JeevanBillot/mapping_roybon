/* Arbres détaillés par espèce : ramification procédurale (portage de EZ-Tree, © 2024 Daniel Greenheck, licence MIT),
   feuillage en rameaux photographiés (chêne, frêne, feuilles rondes, résineux) et écorces photo (Poly Haven / TextureCan, CC0).
   Silhouette réglée par port (feuillu étalé, ovoïde, bouleau, pleureur, cèdre, épicéa, sapin, pin, colonnaire, ginkgo, cépée, buisson dense),
   mise à la hauteur et à la largeur mesurées ; teinte du feuillage et écorce reprises des photos du terrain. Module ES. */
import * as THREE from 'three';

const rng = seed => { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; s = s || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BASE = new URL('./tex/', import.meta.url).href;

// ---------- Textures photo ----------
const loader = new THREE.TextureLoader(), texCache = {};
function tex(file, srgb = true, renderer) {
  if (texCache[file]) return texCache[file];
  const t = loader.load(BASE + file); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  return (texCache[file] = t);
}
// Rameau photographié par type de feuille, et sa couleur moyenne (pour recaler la teinte)
const LEAF = {
  lobed: ['leaf_oak.png', '#5f7d35'], lanceolate: ['leaf_ash.png', '#557931'], ovate: ['leaf_round.png', '#709b3d'], palmate: ['leaf_oak.png', '#5f7d35'],
  cordate: ['leaf_round.png', '#709b3d'], round: ['leaf_round.png', '#709b3d'], fan: ['leaf_round.png', '#709b3d'], needle: ['leaf_pine.png', '#596f29'], scale: ['leaf_pine.png', '#596f29'],
};
const BARK = { furrowed: 'oak', ridged: 'willow', fibrous: 'willow', plates: 'pine', birch: 'birch' }; // 'smooth' : texture dessinée

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

function windify(mat, U, amp) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 wp = vec3(modelMatrix[3]); float wsc = 1.;
      #ifdef USE_INSTANCING
        wp += vec3(instanceMatrix[3]); wsc = length(instanceMatrix[1].xyz);
      #endif
      float ph = wp.x * .21 + wp.z * .17;
      float sw = (sin(uTime * 1.3 + ph) * .6 + sin(uTime * 2.1 + ph * 1.7) * .4) * ${amp.toFixed(4)} * max(0., transformed.y) * wsc;
      float fl = sin(uTime * 7. + position.x * 3.1 + position.z * 2.3) * .025;
      transformed.x += sw + fl; transformed.z += sw * .6 + fl;`);
    sh.fragmentShader = sh.fragmentShader.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;');
  };
  return mat;
}

/* Construit l'arbre détaillé. h : hauteur (m), rad : rayon de couronne (m). */

// ---------- Ports (paramètres de ramification) ----------
/* type : 'deciduous' (branche terminale) ou 'evergreen' (tronc unique, branches décroissantes).
   Par niveau : angle (°), enfants, longueur, rayon relatif, sections, segments, départ, conicité, torsion, noueux. */
const P = (o) => Object.assign({ type: 'deciduous', force: .0, levels: 3, leaves: { angle: 36, count: 10, start: .15, size: 4.5, var: .6 } }, o);
const FORMS = {
  broad: P({ angle: [0, 54, 43, 32], children: [9, 5, 3], length: [47.7, 29.4, 17.6, 7.2], radius: [3, .69, .69, 1.19], sections: [14, 8, 6, 3], segments: [10, 5, 3, 3], start: [0, .35, .1, 0], taper: [.73, .42, .69, .75], twist: [-.23, .42, 0, 0], gnarl: [-.04, .16, -.06, .09], force: -.025, trunkR: .028 }),
  ovoid: P({ angle: [0, 39, 39, 51], children: [10, 4, 3], length: [45, 24, 13, 4.6], radius: [3, .53, .79, 1.11], sections: [12, 8, 6, 4], segments: [8, 6, 4, 3], start: [0, .32, .34, 0], taper: [.7, .62, .76, 0], twist: [.09, -.07, 0, 0], gnarl: [-.05, .2, .16, .05], force: -.008, leaves: { angle: 30, count: 10, start: .01, size: 4.6, var: .6 }, trunkR: .025 }),
  birch: P({ levels: 2, angle: [0, 47, 63], children: [12, 7], length: [69.6, 18.6, 11.2], radius: [1.11, .58, .7], sections: [12, 10, 8], segments: [8, 6, 4], start: [0, .5, .05], taper: [.7, .13, .7], twist: [0, 0, 0], gnarl: [.05, -.03, .12], force: .02, leaves: { angle: 36, count: 20, start: .15, size: 3.5, var: .6 }, trunkR: .014 }),
  weeping: P({ angle: [0, 55, 70, 60], children: [9, 5, 4], length: [30, 22, 16, 9], radius: [3, .6, .6, .8], sections: [10, 8, 8, 6], segments: [10, 5, 3, 3], start: [0, .45, .1, 0], taper: [.7, .5, .7, .7], twist: [0, .2, 0, 0], gnarl: [-.03, .1, .05, .05], force: -.05, leaves: { angle: 25, count: 14, start: .05, size: 3.5, var: .5 }, trunkR: .035 }),
  ginkgo: P({ levels: 2, angle: [0, 28, 55], children: [8, 8], length: [55, 28, 9], radius: [1.3, .6, .7], sections: [12, 8, 5], segments: [8, 5, 3], start: [0, .25, .1], taper: [.7, .6, .7], twist: [0, .1, 0], gnarl: [.04, .08, .1], force: .02, leaves: { angle: 40, count: 14, start: .05, size: 3.6, var: .5 }, trunkR: .018 }),
  multistem: P({ angle: [0, 22, 62, 60], children: [7, 3, 2], length: [.1, 15.3, 5.6, 4.6], radius: [.58, .95, .76, .7], sections: [6, 6, 8, 6], segments: [4, 4, 4, 3], start: [0, .53, .33, 0], taper: [.7, .7, .7, .7], twist: [.3, -.07, 0, 0], gnarl: [.11, .09, .05, .09], force: -.02, leaves: { angle: 55, count: 12, start: 0, size: 2.45, var: .6 }, trunkR: .02 }),
  dense: P({ angle: [0, 40, 62, 60], children: [10, 4, 3], length: [3, 15, 6, 4.6], radius: [.9, .9, .76, .7], sections: [6, 6, 8, 5], segments: [6, 4, 4, 3], start: [0, .2, .2, 0], taper: [.7, .7, .7, .7], twist: [.3, -.07, 0, 0], gnarl: [.08, .09, .05, .09], force: -.012, leaves: { angle: 55, count: 16, start: 0, size: 2.8, var: .5 }, trunkR: .03 }),
  columnar: P({ levels: 2, angle: [0, 18, 30], children: [34, 5], length: [60, 16, 7], radius: [1.2, .5, .7], sections: [14, 6, 4], segments: [8, 4, 3], start: [0, .12, .1], taper: [.7, .6, .7], twist: [0, 0, 0], gnarl: [.02, .05, .05], force: .03, leaves: { angle: 30, count: 12, start: .05, size: 3.2, var: .5 }, trunkR: .02 }),
  columnarEver: P({ type: 'evergreen', levels: 1, angle: [0, 35], children: [90], length: [55, 11], radius: [1.1, .45], sections: [14, 6], segments: [8, 4], start: [0, .05], taper: [.7, .7], twist: [0, 0], gnarl: [.02, .06], force: .02, leaves: { angle: 30, count: 14, start: .05, size: 2.6, var: .3 }, trunkR: .02 }),
  spruce: P({ type: 'evergreen', levels: 2, angle: [0, 112, 55], children: [150, 4], length: [65, 32, 9], radius: [1.27, .37, .5], sections: [16, 10, 4], segments: [8, 5, 3], start: [0, .06, .15], taper: [.7, .7, .7], twist: [0, 0, 0], gnarl: [.04, .08, .08], force: .006, leaves: { angle: 25, count: 14, start: .05, size: 3.4, var: .25 }, trunkR: .015 }),
  fir: P({ type: 'evergreen', levels: 2, angle: [0, 95, 50], children: [130, 4], length: [60, 27, 8], radius: [1.2, .36, .5], sections: [16, 10, 4], segments: [8, 5, 3], start: [0, .06, .15], taper: [.7, .7, .7], twist: [0, 0, 0], gnarl: [.03, .06, .08], force: .004, leaves: { angle: 30, count: 14, start: .05, size: 3.2, var: .25 }, trunkR: .016 }),
  pine: P({ type: 'evergreen', levels: 2, angle: [0, 62, 40], children: [22, 5], length: [55, 30, 9], radius: [1.3, .45, .6], sections: [14, 8, 5], segments: [8, 5, 3], start: [0, .58, .2], taper: [.7, .7, .7], twist: [0, .1, 0], gnarl: [.06, .12, .1], force: .015, leaves: { angle: 35, count: 16, start: .2, size: 3.4, var: .3 }, trunkR: .02 }),
  cedar: P({ type: 'evergreen', levels: 2, angle: [0, 88, 70], children: [44, 12], length: [55, 44, 13], radius: [1.8, .45, .6], sections: [16, 8, 5], segments: [10, 5, 3], start: [0, .12, .05], taper: [.7, .7, .7], twist: [0, .15, 0], gnarl: [.04, .06, .08], force: .003, leaves: { angle: 75, count: 22, start: .02, size: 4.4, var: .3 }, trunkR: .028 }),
};

// ---------- Générateur (d'après EZ-Tree) ----------
function generate(o, seed, lite) {
  const r = rng(seed), rand = (max = 1, min = 0) => min + r() * (max - min);
  const B = { v: [], n: [], uv: [], idx: [] }, L = { v: [], uv: [], idx: [] };
  const queue = [{ origin: new THREE.Vector3(), ori: new THREE.Euler(), length: o.length[0], radius: o.radius[0], level: 0, sections: o.sections[0], segments: o.segments[0] }];
  const up = new THREE.Vector3(0, 1, 0), qForce = new THREE.Quaternion(), leafK = lite ? .6 : 1;
  const leafCount = Math.max(3, Math.round(o.leaves.count * leafK)), leafSize = o.leaves.size * (lite ? 1.2 : 1);
  const leaf = (origin, ori) => {
    const s = leafSize * (1 + rand(o.leaves.var, -o.leaves.var)), W = s, H = s;
    for (const rot of [0, Math.PI / 2]) {
      const i = L.v.length / 3, e = new THREE.Euler(0, rot + rand(.4, -.4), 0);
      for (const [x, y] of [[-W / 2, H], [-W / 2, 0], [W / 2, 0], [W / 2, H]]) { const p = new THREE.Vector3(x, y, 0).applyEuler(e).applyEuler(ori).add(origin); L.v.push(p.x, p.y, p.z); }
      L.uv.push(0, 1, 0, 0, 1, 0, 1, 1); L.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
  };
  const along = (sections, t) => { // origine / orientation / rayon interpolés le long d'une branche
    const k = Math.floor(t * (sections.length - 1)), a = sections[k], b = sections[Math.min(k + 1, sections.length - 1)], al = t * (sections.length - 1) - k;
    const qa = new THREE.Quaternion().setFromEuler(a.ori), qb = new THREE.Quaternion().setFromEuler(b.ori);
    return { origin: new THREE.Vector3().lerpVectors(a.origin, b.origin, al), ori: new THREE.Euler().setFromQuaternion(qb.slerp(qa, al)), radius: (1 - al) * a.radius + al * b.radius };
  };
  const spin = (parentOri, angleDeg, radial) => new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromEuler(parentOri).multiply(new THREE.Quaternion().setFromAxisAngle(up, radial).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleDeg * Math.PI / 180))));
  while (queue.length) {
    const br = queue.shift(), off = B.v.length / 3, secs = [], secLen = br.length / br.sections;
    let ori = br.ori.clone(), org = br.origin.clone(), vAcc = 0;
    const vScale = 1 / (2 * Math.PI * Math.max(br.radius, .05));
    for (let i = 0; i <= br.sections; i++) {
      let rad = br.radius;
      if (i === br.sections && br.level === o.levels) rad = .001;
      else if (o.type === 'deciduous') rad *= 1 - o.taper[br.level] * (i / br.sections);
      else rad *= 1 - i / br.sections;
      for (let j = 0; j <= br.segments; j++) {
        const a = 2 * Math.PI * (j % br.segments) / br.segments, nrm = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).applyEuler(ori), p = nrm.clone().multiplyScalar(rad).add(org);
        B.v.push(p.x, p.y, p.z); B.n.push(nrm.x, nrm.y, nrm.z); B.uv.push(j / br.segments, vAcc * vScale);
      }
      secs.push({ origin: org.clone(), ori: ori.clone(), radius: rad });
      org.add(new THREE.Vector3(0, secLen, 0).applyEuler(ori)); vAcc += secLen;
      const g = Math.max(1, 1 / Math.sqrt(Math.max(rad, 1e-3))) * o.gnarl[br.level];
      ori.x += rand(g, -g); ori.z += rand(g, -g);
      const q = new THREE.Quaternion().setFromEuler(ori).multiply(new THREE.Quaternion().setFromAxisAngle(up, o.twist[br.level]));
      q.rotateTowards(qForce.setFromUnitVectors(up, up), o.force / Math.max(rad, .02));
      ori.setFromQuaternion(q);
    }
    const N = br.segments + 1;
    for (let i = 0; i < br.sections; i++) for (let j = 0; j < br.segments; j++) { const v1 = off + i * N + j, v2 = v1 + 1, v3 = v1 + N, v4 = v2 + N; B.idx.push(v1, v3, v2, v2, v3, v4); }
    if (o.type === 'deciduous') {
      const last = secs[secs.length - 1];
      if (br.level < o.levels) queue.push({ origin: last.origin, ori: last.ori, length: o.length[br.level + 1], radius: last.radius, level: br.level + 1, sections: br.sections, segments: br.segments });
      else leaf(last.origin, last.ori);
    }
    if (br.level === o.levels) {
      const ro = r();
      for (let i = 0; i < leafCount; i++) { const at = along(secs, rand(1, o.leaves.start)); leaf(at.origin, spin(at.ori, o.leaves.angle, 2 * Math.PI * (ro + i / leafCount))); }
    } else {
      const lv = br.level + 1, count = o.children[br.level], ro = r();
      for (let i = 0; i < count; i++) {
        const t = rand(1, o.start[lv]), at = along(secs, t);
        queue.push({ origin: at.origin, ori: spin(at.ori, o.angle[lv], 2 * Math.PI * (ro + i / count)), length: o.length[lv] * (o.type === 'evergreen' ? 1 - t : 1), radius: o.radius[lv] * at.radius, level: lv, sections: o.sections[lv], segments: o.segments[lv] });
      }
    }
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(B.v, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2)); bg.setIndex(B.idx);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(L.v, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2)); lg.setIndex(L.idx);
  return { bg, lg };
}

// Normales « bombées » : chaque rameau est éclairé comme la surface d'un houppier, sans faces noires
function crownNormals(lg, center, ry) {
  const p = lg.attributes.position, n = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i) - center.x, (p.getY(i) - center.y) / Math.max(ry, .1) * 1.4, p.getZ(i) - center.z).normalize(); v.y = v.y * .8 + .35; v.normalize(); n.set([v.x, v.y, v.z], i * 3); }
  lg.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  // teinte par sommet : plus sombre au cœur et en bas du houppier
  const c = new Float32Array(p.count * 3), bb = lg.boundingBox;
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i) - center.x, dz = p.getZ(i) - center.z, dy = (p.getY(i) - bb.min.y) / Math.max(bb.max.y - bb.min.y, .1);
    const rr = Math.hypot(dx, dz) / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z, .1) * 2;
    const k = clamp(.62 + .3 * dy + .22 * rr, .6, 1.12); c.set([k, k, k * .96], i * 3);
  }
  lg.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

// ---------- Arbre complet ----------
function makeTree({ tr, h, rad, seed, U, renderer, lite = false }) {
  let form = tr.form || 'broad';
  if (form === 'columnar' && (tr.leaf === 'scale' || tr.leaf === 'needle')) form = 'columnarEver';
  const o = FORMS[form] || FORMS.broad, leafKind = LEAF[tr.leaf] ? tr.leaf : (o.type === 'evergreen' ? 'needle' : 'ovate');
  // 1re passe : taille brute → rayon de tronc réaliste ; 2e passe définitive
  let { bg, lg } = generate(o, seed, lite); bg.computeBoundingBox(); lg.computeBoundingBox();
  const bb0 = bg.boundingBox.clone().union(lg.boundingBox), s0 = h / Math.max(bb0.max.y, .1);
  const wantR = clamp(h * o.trunkR, .05, .75), o2 = { ...o, radius: [wantR / s0, ...o.radius.slice(1)] };
  bg.dispose(); lg.dispose(); ({ bg, lg } = generate(o2, seed, lite));
  bg.computeBoundingBox(); lg.computeBoundingBox();
  const bb = bg.boundingBox.clone().union(lg.boundingBox), s = h / Math.max(bb.max.y, .1);
  const halfW = Math.max((bb.max.x - bb.min.x), (bb.max.z - bb.min.z)) / 2 * s, kx = clamp(rad / Math.max(halfW, .1), .7, 1.4);
  const cx = (bb.max.x + bb.min.x) / 2, cz = (bb.max.z + bb.min.z) / 2;
  const M = new THREE.Matrix4().makeScale(s * kx, s, s * kx).multiply(new THREE.Matrix4().makeTranslation(-cx * .6, 0, -cz * .6));
  bg.applyMatrix4(M); lg.applyMatrix4(M); lg.computeBoundingBox(); bg.computeBoundingSphere(); lg.computeBoundingSphere();
  const lb = lg.boundingBox, center = new THREE.Vector3((lb.min.x + lb.max.x) / 2, (lb.min.y + lb.max.y) / 2, (lb.min.z + lb.max.z) / 2);
  crownNormals(lg, center, (lb.max.y - lb.min.y) / 2);

  const bk = BARK[tr.bark], rep = tr.bark === 'birch' ? 1 : 2;
  const barkMat = new THREE.MeshStandardMaterial({ roughness: .95, color: 0xffffff }); // tronc et branches fixes
  if (bk) { barkMat.map = tex(`bark_${bk}_color.jpg`, true, renderer); barkMat.normalMap = tex(`bark_${bk}_normal.jpg`, false, renderer); barkMat.normalScale.set(1.2, 1.2); }
  else { barkMat.map = barkTexture(tr.bark || 'smooth', renderer); barkMat.normalMap = tex('bark_oak_normal.jpg', false, renderer); barkMat.normalScale.set(.35, .35); }
  barkMat.map.repeat.set(rep, rep);

  const [file, avg] = LEAF[leafKind], leafMap = tex(file, true, renderer), texAvg = new THREE.Color(avg);
  const tintFor = (c, k) => { const t = new THREE.Color(1, 1, 1); if (!c) return t; const r = ['r', 'g', 'b'].map(ch => clamp(c[ch] / Math.max(texAvg[ch], .01), .45, 1.9)); return t.setRGB(...r.map(x => 1 + (x - 1) * k)); };
  const leafMat = windify(new THREE.MeshStandardMaterial({ map: leafMap, color: tintFor(new THREE.Color(tr.color), .45), vertexColors: true, alphaTest: .5, side: THREE.DoubleSide, roughness: .85 }), U, .006);
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafMap, alphaTest: .5 });
  return { bg, lg, barkMat, leafMat, depthMat, tintFor };
}

export function buildDetailedTree(opts) {
  const { bg, lg, barkMat, leafMat, depthMat, tintFor } = makeTree(opts);
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(bg, barkMat); trunk.castShadow = true; trunk.receiveShadow = true; group.add(trunk);
  const leaves = new THREE.Mesh(lg, leafMat); leaves.castShadow = true; leaves.receiveShadow = true; leaves.customDepthMaterial = depthMat;
  group.add(leaves);
  return {
    group, leafMat, barkMat,
    setFoliageColor(c) { leafMat.color.copy(tintFor(c, .8)); },
    setBark(t) { t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(1.5, 1.5); barkMat.map = t; barkMat.normalScale.set(.6, .6); barkMat.needsUpdate = true; },
  };
}

/* Modèle d'arbre générique à instancier (arbres non recensés détectés au LiDAR).
   Construit pour une hauteur H0 et un rayon rad0 ; renvoie { H0, rad0, instanced(n) → [troncs, feuillage] }. */
export function treePrototype({ form, leaf, bark, color, seed, U, renderer, lite = true }) {
  const H0 = 15, rad0 = form === 'spruce' || form === 'fir' ? 3 : 5;
  const { bg, lg, barkMat, leafMat, depthMat } = makeTree({ tr: { form, leaf, bark, color }, h: H0, rad: rad0, seed, U, renderer, lite });
  return {
    H0, rad0,
    instanced(n) {
      const t = new THREE.InstancedMesh(bg, barkMat, n), l = new THREE.InstancedMesh(lg, leafMat, n);
      t.castShadow = l.castShadow = true; t.receiveShadow = l.receiveShadow = true; l.customDepthMaterial = depthMat;
      return [t, l];
    },
  };
}
