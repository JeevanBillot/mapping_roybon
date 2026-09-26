/* Données partagées entre l'app, le plan 2D et la 3D : arbres, photos, caractéristiques par espèce. */
'use strict';
window.RoybonData = (() => {
  const cfg = {
    get proxyUrl() { try { return (localStorage.getItem('proxyUrl') || '').replace(/\/+$/, ''); } catch (e) { return ''; } },
    get appToken() { try { return localStorage.getItem('appToken') || ''; } catch (e) { return ''; } },
  };
  const DEFAULT_CENTER = [45.2553, 5.2447]; // Roybon

  function openDB() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('arbres', 1);
        r.onupgradeneeded = e => { const d = e.target.result; d.createObjectStore('trees', { keyPath: 'id' }); d.createObjectStore('photos', { keyPath: 'id' }); };
        r.onsuccess = e => res(e.target.result);
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  const dbGet = (db, store, key) => new Promise(res => { if (!db) return res(key === undefined ? [] : null); const s = db.transaction(store).objectStore(store); const r = key === undefined ? s.getAll() : s.get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
  const api = (path, opts = {}) => fetch(cfg.proxyUrl + path, Object.assign({}, opts, { headers: Object.assign({}, opts.headers || {}, cfg.appToken ? { 'X-App-Token': cfg.appToken } : {}) }));

  let dbP = null; const db = () => (dbP = dbP || openDB());

  async function loadTrees() {
    const local = await dbGet(await db(), 'trees');
    const byId = {}; for (const t of local || []) byId[t.id] = t;
    let source = local && local.length ? 'local' : 'aucune';
    if (cfg.proxyUrl) {
      try {
        const r = await api('/sync/trees');
        if (r.ok) { const { trees } = await r.json(); for (const t of trees) if (!byId[t.id] || (t.updated || 0) > (byId[t.id].updated || 0)) byId[t.id] = t; source = 'cloud'; }
      } catch (e) { /* hors ligne */ }
    }
    const all = Object.values(byId);
    const features = {}; for (const f of localFeatures()) features[f.id] = f;
    for (const f of all.filter(t => t.kind === 'feature')) if (!features[f.id] || (f.updated || 0) >= (features[f.id].updated || 0)) features[f.id] = f;
    return { trees: all.filter(t => t.kind !== 'feature' && t.lat && t.lon && t.species), features: Object.values(features).filter(f => !f.deleted), source };
  }
  // Éléments placés à la main (court de tennis…) : cloud + copie locale
  function localFeatures() { try { return JSON.parse(localStorage.getItem('features') || '[]'); } catch (e) { return []; } }
  function storeLocal(list) { try { localStorage.setItem('features', JSON.stringify(list)); } catch (e) {} }
  async function saveFeature(f) {
    f = Object.assign({ kind: 'feature' }, f, { updated: Date.now() });
    storeLocal(localFeatures().filter(x => x.id !== f.id).concat([f]));
    if (!cfg.proxyUrl) return { ok: true, cloud: false };
    try { const r = await api(`/sync/tree/${f.id}`, { method: 'PUT', body: JSON.stringify(f), headers: { 'Content-Type': 'application/json' } }); return { ok: r.ok, cloud: r.ok }; } catch (e) { return { ok: true, cloud: false }; }
  }
  async function deleteFeature(id) {
    storeLocal(localFeatures().filter(x => x.id !== id));
    if (cfg.proxyUrl) { try { await api(`/sync/tree/${id}`, { method: 'DELETE' }); } catch (e) {} }
  }

  const urls = new Map();
  async function photoURL(id) {
    if (!id) return null;
    if (urls.has(id)) return urls.get(id);
    const p = await dbGet(await db(), 'photos', id);
    let u = null;
    if (p && p.blob) u = URL.createObjectURL(p.blob);
    else if (cfg.proxyUrl) { try { const r = await api(`/sync/photo/${id}`); if (r.ok) u = URL.createObjectURL(await r.blob()); } catch (e) {} }
    urls.set(id, u); return u;
  }
  const photoIds = t => (t.organs || []).map(o => `${t.id}_${o}`);
  const name = t => (t.species && (t.species.common || t.species.sci)) || 'Inconnu';
  function colorFor(n) { let h = 0; for (const c of (n || '?')) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 60% 42%)`; }

  // Silhouette, hauteur adulte typique (m), rayon de houppier (m), teinte du feuillage.
  const GENUS = {
    Quercus: ['round', 22, 7, '#4f7a3a'], Fagus: ['round', 25, 7, '#5b8a3c'], Carpinus: ['round', 15, 5, '#6a9440'], Castanea: ['round', 20, 7, '#557f35'],
    Acer: ['round', 18, 6, '#6b9a3f'], Tilia: ['round', 22, 7, '#6f9e45'], Fraxinus: ['round', 22, 6, '#72a04a'], Ulmus: ['round', 20, 6, '#5d8b3b'],
    Platanus: ['round', 28, 9, '#7aa550'], Juglans: ['round', 18, 8, '#658f3e'], Aesculus: ['round', 22, 7, '#4e7d34'], Robinia: ['round', 18, 5, '#86ad57'],
    Prunus: ['round', 8, 4, '#6f9a45'], Malus: ['round', 7, 4, '#6d9744'], Pyrus: ['round', 10, 3.5, '#6a9442'], Sorbus: ['round', 10, 3.5, '#739e48'],
    Corylus: ['shrub', 5, 3, '#6e9a44'], Sambucus: ['shrub', 5, 3, '#6b9440'], Ilex: ['shrub', 8, 3, '#2f5a2a'], Buxus: ['shrub', 3, 1.5, '#2e5527'], Laurus: ['shrub', 7, 3, '#3b6530'],
    Magnolia: ['round', 10, 5, '#3f6d33'], Alnus: ['round', 18, 4.5, '#557f3a'], Catalpa: ['round', 12, 6, '#7aa84e'], Morus: ['round', 10, 5, '#6c9a42'], Ficus: ['round', 5, 3, '#5f8a3d'],
    Betula: ['slender', 18, 3.5, '#8cb85a'], Populus: ['columnar', 28, 3, '#7ea94f'], Cupressus: ['columnar', 18, 2, '#2f4f2a'], Carpinus_fastigiata: ['columnar', 15, 3, '#6a9440'],
    Salix: ['weeping', 14, 6, '#9cc26a'],
    Pinus: ['pine', 22, 5, '#355a2e'], Abies: ['conifer', 30, 4, '#274a28'], Picea: ['conifer', 30, 3.5, '#2a4d2a'], Cedrus: ['conifer', 25, 7, '#3c5f3f'],
    Larix: ['conifer', 25, 4, '#6f9a4f'], Pseudotsuga: ['conifer', 35, 4.5, '#2d502b'], Sequoiadendron: ['conifer', 40, 5, '#3a5a30'], Sequoia: ['conifer', 35, 4, '#3a5a30'],
    Thuja: ['columnar', 12, 2, '#3b6232'], Chamaecyparis: ['conifer', 15, 2.5, '#355d33'], Taxus: ['conifer', 10, 3, '#233f22'], Juniperus: ['columnar', 6, 1.5, '#3d5e3a'],
    Ginkgo: ['slender', 20, 4, '#9bbf55'], Liriodendron: ['round', 25, 6, '#76a24c'],
  };
  const COMMON = [[/chêne/i, 'Quercus'], [/hêtre/i, 'Fagus'], [/charme/i, 'Carpinus'], [/châtaign/i, 'Castanea'], [/érable/i, 'Acer'], [/tilleul/i, 'Tilia'], [/frêne/i, 'Fraxinus'], [/orme/i, 'Ulmus'], [/platane/i, 'Platanus'], [/noyer/i, 'Juglans'], [/marronnier/i, 'Aesculus'], [/robinier|acacia/i, 'Robinia'], [/cerisier|prunier|merisier|laurier-cerise/i, 'Prunus'], [/pommier/i, 'Malus'], [/poirier/i, 'Pyrus'], [/sorbier/i, 'Sorbus'], [/noisetier/i, 'Corylus'], [/sureau/i, 'Sambucus'], [/houx/i, 'Ilex'], [/buis/i, 'Buxus'], [/laurier/i, 'Laurus'], [/magnolia/i, 'Magnolia'], [/aulne/i, 'Alnus'], [/bouleau/i, 'Betula'], [/peuplier/i, 'Populus'], [/cyprès/i, 'Cupressus'], [/saule/i, 'Salix'], [/(^|\s)pin(\s|$)/i, 'Pinus'], [/sapin/i, 'Abies'], [/épicéa/i, 'Picea'], [/cèdre/i, 'Cedrus'], [/mélèze/i, 'Larix'], [/douglas/i, 'Pseudotsuga'], [/séquoia/i, 'Sequoiadendron'], [/thuya/i, 'Thuja'], [/if\b/i, 'Taxus'], [/genévrier/i, 'Juniperus'], [/ginkgo/i, 'Ginkgo'], [/tulipier/i, 'Liriodendron']];
  function traits(t) {
    let g = ((t.species && t.species.sci) || '').split(/\s+/)[0];
    if (!GENUS[g]) { const c = name(t); const m = COMMON.find(([re]) => re.test(c)); g = m ? m[1] : ''; }
    const [shape, height, crown, color] = GENUS[g] || ['round', 12, 4, '#5f8a3d'];
    const h = +(t.height || 0) || height; // hauteur mesurée si disponible
    return { genus: g || null, shape, height: h, crown: crown * (h / height), color };
  }
  return { cfg, DEFAULT_CENTER, loadTrees, saveFeature, deleteFeature, photoURL, photoIds, name, colorFor, traits };
})();
