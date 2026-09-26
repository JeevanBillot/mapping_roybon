/* Analyse LiDAR HD de l'IGN : terrain (MNT), surface (MNS), hauteur de végétation (MNS − MNT),
   hauteur et contour réels des couronnes, détection des arbres non recensés. Module ES. */
import { fromArrayBuffer } from 'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/+esm';

const R = 6378137;
export const merc = (lat, lon) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
export const unmerc = (x, y) => [(2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI, x / R * 180 / Math.PI];

async function fetchTiff(layer, bbox, w, h, style = '') {
  const url = `https://data.geopf.fr/wms-r?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=${style}&FORMAT=image/geotiff&CRS=EPSG:3857&BBOX=${bbox.join(',')}&WIDTH=${w}&HEIGHT=${h}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${layer} ${r.status}`);
  if (/xml|html|text/.test(r.headers.get('Content-Type') || '')) throw new Error(`${layer} : ${(await r.text()).slice(0, 120)}`);
  const img = await (await fromArrayBuffer(await r.arrayBuffer())).getImage();
  const [band] = await img.readRasters({ samples: [0] });
  const a = Float32Array.from(band);
  let valid = 0; for (const v of a) if (v > -500 && v < 5000) valid++;
  if (valid < a.length * .85) throw new Error(`${layer} : couverture insuffisante`);
  // Trous éventuels : moyenne des voisins valides, en quelques passes
  for (let pass = 0; pass < 20; pass++) {
    let holes = 0;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      const k = i * w + j; if (a[k] > -500 && a[k] < 5000) continue;
      let s = 0, n = 0;
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= h || jj >= w) continue; const v = a[ii * w + jj]; if (v > -500 && v < 5000) { s += v; n++; } }
      if (n) a[k] = s / n; else holes++;
    }
    if (!holes) break;
  }
  return a;
}

/* Charge le relief et la végétation sur l'emprise. size = pixels par côté. */
export async function loadLidar(latMin, lonMin, latMax, lonMax, size = 512, onProgress = () => {}) {
  const [mx0, my0] = merc(latMin, lonMin), [mx1, my1] = merc(latMax, lonMax);
  const bbox = [mx0, my0, mx1, my1], w = size, h = size;
  const cosLat = Math.cos((latMin + latMax) / 2 * Math.PI / 180);
  const px = (mx1 - mx0) / w * cosLat; // taille d'un pixel au sol, en mètres
  let mnt = null, mns = null, source = null;
  onProgress('Relief LiDAR HD (IGN)…');
  try {
    [mnt, mns] = await Promise.all([
      fetchTiff('IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93', bbox, w, h),
      fetchTiff('IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93', bbox, w, h),
    ]);
    source = 'lidar';
  } catch (e) {
    console.warn('LiDAR HD indisponible', e);
    onProgress('Relief RGE ALTI (IGN)…');
    try { mnt = await fetchTiff('ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES', bbox, w, h); source = 'rgealti'; }
    catch (e2) { console.warn('RGE ALTI indisponible', e2); }
  }
  let chm = null;
  if (mnt && mns) { chm = new Float32Array(w * h); for (let k = 0; k < chm.length; k++) chm[k] = Math.max(0, Math.min(60, mns[k] - mnt[k])); }
  return new Lidar({ w, h, bbox, px, mnt, mns, chm, source });
}

export class Lidar {
  constructor(o) { Object.assign(this, o); this.ok = !!this.mnt; }
  toPix(lat, lon) { const [x, y] = merc(lat, lon); const [mx0, my0, mx1, my1] = this.bbox; return [(x - mx0) / (mx1 - mx0) * this.w - .5, (my1 - y) / (my1 - my0) * this.h - .5]; }
  toLatLon(c, r) { const [mx0, my0, mx1, my1] = this.bbox; return unmerc(mx0 + (c + .5) / this.w * (mx1 - mx0), my1 - (r + .5) / this.h * (my1 - my0)); }
  sample(arr, lat, lon) {
    if (!arr) return null;
    let [c, r] = this.toPix(lat, lon); c = Math.max(0, Math.min(this.w - 1.001, c)); r = Math.max(0, Math.min(this.h - 1.001, r));
    const i = Math.floor(r), j = Math.floor(c), di = r - i, dj = c - j, w = this.w;
    return arr[i * w + j] * (1 - di) * (1 - dj) + arr[i * w + j + 1] * (1 - di) * dj + arr[(i + 1) * w + j] * di * (1 - dj) + arr[(i + 1) * w + j + 1] * di * dj;
  }
  ground(lat, lon) { return this.sample(this.mnt, lat, lon); }
  get smooth() {
    if (this._s || !this.chm) return this._s;
    const { w, h, chm } = this, s = new Float32Array(w * h), k = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) { let a = 0, n = 0, q = 0; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++, q++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= h || jj >= w) continue; a += chm[ii * w + jj] * k[q]; n += k[q]; } s[i * w + j] = a / n; }
    return (this._s = s);
  }
  /* Contour de couronne par balayage radial depuis un sommet. */
  crownFrom(r0, c0) {
    const { w, h, px } = this, s = this.smooth, top = s[r0 * w + c0], N = 24, radii = [];
    for (let d = 0; d < N; d++) {
      const a = d / N * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
      let prev = top, rr = 0;
      for (let t = 1; t * px < 14; t++) {
        const i = Math.round(r0 + dy * t), j = Math.round(c0 + dx * t);
        if (i < 0 || j < 0 || i >= h || j >= w) break;
        const v = s[i * w + j];
        if (v < Math.max(1.5, top * .45) || v > prev + .9) break;
        prev = Math.min(prev, v); rr = t;
      }
      radii.push(Math.max(1, rr) * px);
    }
    const sm = radii.map((r, k) => (radii[(k + N - 1) % N] + 2 * r + radii[(k + 1) % N]) / 4);
    const radius = sm.slice().sort((a, b) => a - b)[N >> 1];
    const outline = sm.map((r, k) => { const a = k / N * Math.PI * 2; return this.toLatLon(c0 + Math.cos(a) * r / px, r0 + Math.sin(a) * r / px); });
    const [lat, lon] = this.toLatLon(c0, r0);
    return { lat, lon, height: top, radius, outline };
  }
  /* Couronne réelle autour d'un point relevé (recherche du sommet le plus proche). */
  crownAt(lat, lon, searchM = 3.5) {
    if (!this.chm) return null;
    const s = this.smooth, [c, r] = this.toPix(lat, lon), rad = Math.ceil(searchM / this.px);
    let best = -1, bi = 0, bj = 0;
    for (let i = Math.round(r) - rad; i <= Math.round(r) + rad; i++) for (let j = Math.round(c) - rad; j <= Math.round(c) + rad; j++) {
      if (i < 0 || j < 0 || i >= this.h || j >= this.w || (i - r) ** 2 + (j - c) ** 2 > rad * rad) continue;
      const v = s[i * this.w + j]; if (v > best) { best = v; bi = i; bj = j; }
    }
    if (best < 2) return null;
    return this.crownFrom(bi, bj);
  }
  /* Arbres visibles dans la hauteur de végétation (maxima locaux), hors bâtiments. */
  detectTrees({ minHeight = 3, exclude = () => false, max = 2500 } = {}) {
    if (!this.chm) return [];
    const { w, h, px } = this, s = this.smooth, cand = [];
    for (let i = 2; i < h - 2; i++) for (let j = 2; j < w - 2; j++) {
      const v = s[i * w + j]; if (v < minHeight) continue;
      const rad = Math.max(2, Math.round(Math.min(4.5, 1.2 + v * .08) / px));
      let isMax = true;
      for (let di = -rad; di <= rad && isMax; di++) for (let dj = -rad; dj <= rad; dj++) {
        if (di * di + dj * dj > rad * rad || (!di && !dj)) continue;
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= h || jj >= w) continue;
        if (s[ii * w + jj] > v) { isMax = false; break; }
      }
      if (isMax) cand.push([v, i, j]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    const out = [];
    for (const [v, i, j] of cand) {
      if (out.length >= max) break;
      const [lat, lon] = this.toLatLon(j, i);
      if (exclude(lat, lon)) continue;
      const cr = this.crownFrom(i, j);
      if (out.some(o => Math.hypot(o._c - j, o._r - i) * px < Math.max(1.8, Math.min(o.radius, cr.radius) * .7))) continue;
      cr._c = j; cr._r = i; out.push(cr);
    }
    return out;
  }
  /* Image d'ombrage du relief (MNT). */
  hillshadeCanvas(z = 1.6) {
    const { w, h, mnt, px } = this, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), az = 315 * Math.PI / 180, alt = 45 * Math.PI / 180;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      const g = (ii, jj) => mnt[Math.max(0, Math.min(h - 1, ii)) * w + Math.max(0, Math.min(w - 1, jj))];
      const dzdx = (g(i, j + 1) - g(i, j - 1)) / (2 * px) * z, dzdy = (g(i + 1, j) - g(i - 1, j)) / (2 * px) * z;
      const slope = Math.atan(Math.hypot(dzdx, dzdy)), aspect = Math.atan2(dzdy, -dzdx);
      const v = Math.max(0, Math.cos(alt) * Math.cos(slope) + Math.sin(alt) * Math.sin(slope) * Math.cos(az - aspect));
      const k = (i * w + j) * 4, sh = Math.round(255 * v);
      img.data[k] = img.data[k + 1] = img.data[k + 2] = sh; img.data[k + 3] = Math.round(Math.max(0, (.75 - v)) * 230);
    }
    ctx.putImageData(img, 0, 0); return cv;
  }
  /* Image de la hauteur de végétation, du vert clair (bas) au vert profond (haut). */
  chmCanvas() {
    const { w, h, chm } = this, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
    const stops = [[2, [217, 240, 163]], [6, [120, 198, 121]], [12, [49, 163, 84]], [20, [0, 104, 55]], [35, [0, 60, 30]]];
    for (let k = 0; k < w * h; k++) {
      const v = chm[k]; if (v < 1.5) continue;
      let c = stops[stops.length - 1][1];
      for (let s = 0; s < stops.length - 1; s++) if (v < stops[s + 1][0]) { const t = Math.max(0, (v - stops[s][0]) / (stops[s + 1][0] - stops[s][0])); c = stops[s][1].map((x, q) => x + (stops[s + 1][1][q] - x) * t); break; }
      img.data[k * 4] = c[0]; img.data[k * 4 + 1] = c[1]; img.data[k * 4 + 2] = c[2]; img.data[k * 4 + 3] = 190;
    }
    ctx.putImageData(img, 0, 0); return cv;
  }
  get boundsLatLon() { const [mx0, my0, mx1, my1] = this.bbox; return [unmerc(mx0, my0), unmerc(mx1, my1)]; }
}

/* Requête WFS BD TOPO sur l'emprise ; coordonnées renvoyées en [lat, lon]. */
async function fetchWFS(type, latMin, lonMin, latMax, lonMax, count = 1000) {
  const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${type}&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326&COUNT=${count}&BBOX=${latMin},${lonMin},${latMax},${lonMax},urn:ogc:def:crs:EPSG::4326`;
  const gj = await (await fetch(url)).json();
  const latC = (latMin + latMax) / 2, fix = c => Math.abs(c[0] - latC) < Math.abs(c[1] - latC) ? [c[0], c[1]] : [c[1], c[0]];
  return (gj.features || []).filter(f => f.geometry).map(f => ({ g: f.geometry, props: f.properties || {}, fix }));
}
const polysOf = ({ g, fix }) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).map(rings => rings.map(r => r.map(fix)));
const linesOf = ({ g, fix }) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []).map(l => l.map(fix));

/* Bâtiments BD TOPO (emprise + hauteur + altitudes de toit). */
export async function fetchBuildings(latMin, lonMin, latMax, lonMax) {
  const out = [];
  for (const f of await fetchWFS('BDTOPO_V3:batiment', latMin, lonMin, latMax, lonMax))
    for (const rings of polysOf(f)) out.push({ rings, height: +f.props.hauteur || null, props: f.props });
  return out;
}

/* Eau BD TOPO : plans d'eau et surfaces (polygones), cours d'eau (lignes) avec nom et largeur. */
const propLike = (p, re) => { for (const k in p) if (re.test(k) && p[k] != null && p[k] !== '') return p[k]; return null; };
function streamWidth(p) {
  const v = propLike(p, /largeur/i);
  if (typeof v === 'number' && v > 0) return Math.min(v, 30);
  const nums = String(v || '').match(/\d+(?:[.,]\d+)?/g);
  if (nums && nums.length) { const hi = +nums[nums.length - 1].replace(',', '.'); return hi <= 15 ? 3 : Math.min(30, hi * .5); }
  return 3;
}
export async function fetchWater(latMin, lonMin, latMax, lonMax) {
  const [lakes, surfaces, lines] = await Promise.all([
    fetchWFS('BDTOPO_V3:plan_d_eau', latMin, lonMin, latMax, lonMax).catch(() => []),
    fetchWFS('BDTOPO_V3:surface_hydrographique', latMin, lonMin, latMax, lonMax).catch(() => []),
    fetchWFS('BDTOPO_V3:troncon_hydrographique', latMin, lonMin, latMax, lonMax).catch(() => []),
  ]);
  const areas = [];
  for (const f of [...lakes, ...surfaces]) for (const rings of polysOf(f)) areas.push({ rings, name: propLike(f.props, /toponyme/i), nature: f.props.nature || null });
  const streams = [];
  for (const f of lines) {
    const p = f.props, pos = p.position_par_rapport_au_sol;
    if (p.fictif === true || p.fictif === 'Vrai' || /souterrain/i.test(String(pos)) || +pos < 0) continue;
    for (const coords of linesOf(f)) streams.push({ coords, name: propLike(p, /toponyme/i), width: streamWidth(p), nature: p.nature || null });
  }
  return { areas, streams };
}
export function inPolygon(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const inBuildings = (lat, lon, bs, marginDeg = 0) => bs.some(b => inPolygon(lat, lon, b.rings[0]) || (marginDeg && [[marginDeg, 0], [-marginDeg, 0], [0, marginDeg], [0, -marginDeg]].some(([a, c]) => inPolygon(lat + a, lon + c, b.rings[0]))));
