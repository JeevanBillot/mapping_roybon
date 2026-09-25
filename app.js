/* Arbres de Roybon — collecte terrain (PWA) */
'use strict';

// ---------- IndexedDB ----------
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('arbres', 1);
    r.onupgradeneeded = e => { const d = e.target.result; d.createObjectStore('trees', { keyPath: 'id' }); d.createObjectStore('photos', { keyPath: 'id' }); };
    r.onsuccess = e => { db = e.target.result; res(db); };
    r.onerror = rej;
  });
}
const tx = (store, mode, fn) => new Promise((res, rej) => { const t = db.transaction(store, mode); const out = fn(t.objectStore(store)); t.oncomplete = () => res(out && out.result); t.onerror = rej; });
const getAll = store => new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = rej; });
const getOne = (store, k) => new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).get(k); r.onsuccess = () => res(r.result); r.onerror = rej; });
const put = (store, v) => tx(store, 'readwrite', s => s.put(v));
const del = (store, k) => tx(store, 'readwrite', s => s.delete(k));

// ---------- Réglages ----------
const settings = {
  get proxyUrl() { return (localStorage.getItem('proxyUrl') || '').replace(/\/+$/, ''); }, set proxyUrl(v) { localStorage.setItem('proxyUrl', v); },
  get appToken() { return localStorage.getItem('appToken') || ''; }, set appToken(v) { localStorage.setItem('appToken', v); },
  get gpsSeconds() { return +(localStorage.getItem('gpsSeconds') || 20); }, set gpsSeconds(v) { localStorage.setItem('gpsSeconds', v); },
  get pendingDeletes() { return JSON.parse(localStorage.getItem('pendingDeletes') || '[]'); }, set pendingDeletes(v) { localStorage.setItem('pendingDeletes', JSON.stringify(v)); },
};

// ---------- Helpers ----------
const ico = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const haptic = () => navigator.vibrate && navigator.vibrate(25);
function toast(msg, ms = 2500) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), ms); }
const show = (el, on = true) => el.classList.toggle('hidden', !on);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function colorFor(name) { let h = 0; for (const c of (name || '?')) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 60% 42%)`; }
const speciesName = t => t.species.common || t.species.sci || 'Inconnu';
const IGN_ORTHO = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg';
const IGN_PLAN = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png';
const hasLeaflet = () => typeof L !== 'undefined';
const photoURLs = new Map();
async function photoSrc(id) {
  if (photoURLs.has(id)) return photoURLs.get(id);
  let p = await getOne('photos', id);
  if (!p && settings.proxyUrl && navigator.onLine) {
    try { const r = await api(`/sync/photo/${id}`); if (r.ok) { const blob = await r.blob(); const [treeId, organ] = [id.slice(0, id.lastIndexOf('_')), id.slice(id.lastIndexOf('_') + 1)]; p = { id, treeId, organ, blob, synced: true }; await put('photos', p); } } catch (e) { /* offline */ }
  }
  if (!p) return null;
  const u = URL.createObjectURL(p.blob); photoURLs.set(id, u); return u;
}
const firstPhotoId = t => t.organs && t.organs.length ? `${t.id}_${t.organs.includes('leaf') ? 'leaf' : t.organs[0]}` : null;

// ---------- Navigation ----------
$$('nav button').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
function switchView(v) {
  $$('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'list') renderList();
  if (v === 'map') renderMap();
}
function setStep(n) { $$('.stepper li').forEach(li => { const s = +li.dataset.step; li.classList.toggle('on', s === n); li.classList.toggle('done', s < n); }); }

// ---------- État de saisie ----------
let current = null, miniMap = null, miniMarker = null, gpsAbort = null;
function resetCapture() {
  current = null; setStep(1);
  show($('#step-gps')); show($('#gps-status'), false); show($('#pos-card'), false); show($('#btn-gps'));
  show($('#step-photos'), false); show($('#step-save'), false); show($('#btn-cancel'), false);
  $$('.photo-slot').forEach(s => { s.classList.remove('filled'); s.querySelector('img').src = ''; s.querySelector('input').value = ''; });
  $('#results').innerHTML = ''; show($('#manual'), false); show($('#id-status'), false);
  $('#note').value = ''; $('#manual-species').value = '';
}
$('#btn-cancel').addEventListener('click', () => { if (confirm('Abandonner cet arbre ?')) resetCapture(); });

// ---------- Étape 1 : GPS moyenné ----------
$('#btn-gps').addEventListener('click', startGPS);
$('#btn-pos-redo').addEventListener('click', () => { show($('#pos-card'), false); show($('#btn-gps')); startGPS(); });
$('#btn-gps-stop').addEventListener('click', () => gpsAbort && gpsAbort());
async function startGPS() {
  if (!navigator.geolocation) return toast('Pas de GPS disponible');
  haptic();
  const dur = settings.gpsSeconds * 1000, samples = [], t0 = Date.now();
  show($('#gps-status')); show($('#btn-gps'), false); show($('#btn-cancel'));
  $('#gps-ring').style.strokeDashoffset = 100.5; $('#gps-acc').textContent = '—'; $('#gps-text').textContent = 'Recherche des satellites…';
  await new Promise(resolve => {
    let done = false;
    const onPos = p => {
      if (done) return;
      samples.push({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude });
      const el = Date.now() - t0;
      $('#gps-ring').style.strokeDashoffset = 100.5 * (1 - Math.min(1, el / dur));
      $('#gps-acc').textContent = `±${p.coords.accuracy.toFixed(0)} m`;
      $('#gps-text').textContent = `${samples.length} mesures · ${Math.max(0, Math.ceil((dur - el) / 1000))} s`;
    };
    const opts = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
    const wid = navigator.geolocation.watchPosition(onPos, err => toast('Erreur GPS : ' + err.message), opts);
    const iv = setInterval(() => navigator.geolocation.getCurrentPosition(onPos, () => {}, opts), 1000);
    const finish = () => { if (done) return; done = true; navigator.geolocation.clearWatch(wid); clearInterval(iv); clearTimeout(to); resolve(); };
    const to = setTimeout(finish, dur); gpsAbort = finish;
  });
  gpsAbort = null;
  if (!samples.length) { show($('#gps-status'), false); show($('#btn-gps')); return toast('Aucune position reçue'); }
  const accs = samples.map(s => s.acc).sort((a, b) => a - b), med = accs[Math.floor(accs.length / 2)];
  const good = samples.filter(s => s.acc <= med * 2);
  let W = 0, lat = 0, lon = 0, alt = 0, nAlt = 0;
  for (const s of good) { const w = 1 / (s.acc * s.acc); W += w; lat += s.lat * w; lon += s.lon * w; if (s.alt != null) { alt += s.alt; nAlt++; } }
  lat /= W; lon /= W;
  current = { id: Date.now().toString(36), lat, lon, gpsLat: lat, gpsLon: lon, acc: Math.sqrt(1 / W), accMin: accs[0], samples: good.length, alt: nAlt ? alt / nAlt : null, date: new Date().toISOString(), photos: {}, corrected: false };
  $('#pos-text').textContent = `±${current.acc.toFixed(1)} m (${good.length} mesures)`;
  show($('#gps-status'), false); show($('#pos-card')); haptic();
  showMiniMap();
}
function showMiniMap() {
  if (!hasLeaflet()) { $('#mini-map').textContent = 'Carte indisponible hors ligne'; return; }
  if (!miniMap) {
    miniMap = L.map('mini-map', { zoomControl: false, attributionControl: false });
    L.tileLayer(IGN_ORTHO, { maxZoom: 21, maxNativeZoom: 19 }).addTo(miniMap);
    miniMarker = L.marker([0, 0], { draggable: true, autoPan: true }).addTo(miniMap);
    miniMarker.on('dragend', () => { const ll = miniMarker.getLatLng(); current.lat = ll.lat; current.lon = ll.lng; current.corrected = true; haptic(); });
  }
  miniMarker.setLatLng([current.lat, current.lon]);
  miniMap.setView([current.lat, current.lon], 20);
  setTimeout(() => miniMap.invalidateSize(), 60);
}
$('#btn-pos-ok').addEventListener('click', () => { haptic(); show($('#step-gps'), false); show($('#step-photos')); setStep(2); });

// ---------- Étape 2 : photos + identification ----------
function downscale(file, max = 1280) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => { URL.revokeObjectURL(img.src); res(b); }, 'image/jpeg', 0.85); };
    img.src = URL.createObjectURL(file);
  });
}
$$('.photo-slot').forEach(slot => {
  const inp = slot.querySelector('input');
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f || !current) return;
    const blob = await downscale(f);
    current.photos[slot.dataset.organ] = blob;
    slot.querySelector('img').src = URL.createObjectURL(blob); slot.classList.add('filled'); haptic();
    identify();
  });
  slot.querySelector('.x').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); delete current.photos[slot.dataset.organ]; slot.classList.remove('filled'); inp.value = ''; $('#results').innerHTML = ''; });
});
async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, settings.appToken ? { 'X-App-Token': settings.appToken } : {});
  return fetch(settings.proxyUrl + path, Object.assign({}, opts, { headers }));
}
let identifying = false, identifyAgain = false;
async function identify() {
  if (!settings.proxyUrl) { toast('Renseigne l\'URL du relais dans Réglages'); return switchView('settings'); }
  if (identifying) { identifyAgain = true; return; }
  const organs = Object.keys(current.photos); if (!organs.length) return;
  identifying = true;
  const fd = new FormData();
  for (const o of organs) { fd.append('images', current.photos[o], o + '.jpg'); fd.append('organs', o); }
  const st = $('#id-status'); show(st); st.className = 'card status loading'; st.textContent = `Identification (${organs.length} photo${organs.length > 1 ? 's' : ''})…`;
  try {
    const r = await api('/identify?lang=fr&nb-results=5&include-related-images=true', { method: 'POST', body: fd });
    if (r.status === 404) { st.className = 'card status'; st.textContent = 'Aucune espèce reconnue. Ajoute une photo de feuille, ou saisis à la main.'; $('#results').innerHTML = ''; }
    else if (!r.ok) { let msg = ''; try { const j = await r.json(); msg = j.message || j.error || ''; } catch (e) {} st.className = 'card status'; st.textContent = `Erreur ${r.status}${msg ? ' : ' + msg : ''}`; }
    else { const data = await r.json(); current.apiRaw = data.results.slice(0, 5).map(x => ({ sci: x.species.scientificNameWithoutAuthor, score: x.score })); show(st, false); renderResults(data.results.slice(0, 5)); }
  } catch (e) { st.className = 'card status'; st.textContent = 'Pas de réseau. Saisis l\'espèce à la main : les photos sont conservées.'; }
  identifying = false;
  if (identifyAgain) { identifyAgain = false; identify(); }
}
function renderResults(results) {
  const ul = $('#results'); ul.innerHTML = '';
  results.forEach((x, i) => {
    const li = document.createElement('li');
    const img = x.images && x.images[0] && x.images[0].url ? x.images[0].url.s : '';
    const common = (x.species.commonNames || [])[0] || '', sci = x.species.scientificNameWithoutAuthor;
    li.style.setProperty('--w', Math.round(x.score * 100) + '%'); if (i === 0 && x.score > .5) li.classList.add('best');
    li.innerHTML = `${img ? `<img src="${esc(img)}" alt="">` : `<div class="ph">${ico('tree')}</div>`}<div class="name"><b>${esc(common || sci)}</b><i>${esc(sci)}</i></div><div class="score">${Math.round(x.score * 100)} %</div>`;
    li.addEventListener('click', () => choose({ common, sci, family: x.species.family && x.species.family.scientificNameWithoutAuthor, score: x.score, source: 'plantnet', refImg: img }));
    ul.appendChild(li);
  });
}
$('#btn-manual').addEventListener('click', async () => { show($('#manual')); const names = [...new Set((await getAll('trees')).map(speciesName))]; $('#species-list').innerHTML = names.map(n => `<option value="${esc(n)}">`).join(''); $('#manual-species').focus(); });
$('#btn-manual-ok').addEventListener('click', () => { const v = $('#manual-species').value.trim(); if (v) choose({ common: v, sci: '', score: null, source: 'manuel' }); });
async function choose(sp) {
  current.species = sp; haptic();
  $('#chosen-common').textContent = sp.common || sp.sci; $('#chosen-sci').textContent = sp.common ? sp.sci : '';
  $('#chosen-score').textContent = sp.score != null ? `Pl@ntNet ${Math.round(sp.score * 100)} %` : 'Saisie manuelle';
  const th = $('#chosen-img'); const own = current.photos.leaf || current.photos.habit || Object.values(current.photos)[0];
  th.style.backgroundImage = own ? `url(${URL.createObjectURL(own)})` : sp.refImg ? `url(${sp.refImg})` : ''; th.style.backgroundSize = 'cover';
  show($('#step-photos'), false); show($('#step-save')); setStep(3);
}
$('#btn-back').addEventListener('click', () => { show($('#step-save'), false); show($('#step-photos')); setStep(2); });

// ---------- Étape 3 : enregistrement ----------
$('#btn-save').addEventListener('click', async () => {
  current.note = $('#note').value.trim();
  const { photos, ...tree } = current;
  tree.organs = Object.keys(photos); tree.updated = Date.now(); tree.synced = false;
  await put('trees', tree);
  for (const o of tree.organs) await put('photos', { id: `${tree.id}_${o}`, treeId: tree.id, organ: o, blob: photos[o], synced: false });
  haptic(); toast(`${speciesName(tree)} enregistré`);
  resetCapture(); updateCount(); sync();
});
async function updateCount() { const trees = await getAll('trees'); $('#count').textContent = trees.length; const n = trees.filter(t => !t.synced).length; $('#sync-text').textContent = settings.proxyUrl ? (n ? `${n} à envoyer` : 'à jour') : 'hors ligne'; $('#sync-icon').innerHTML = ico(!settings.proxyUrl ? 'cloud-off' : n ? 'cloud-up' : 'cloud-ok'); }

// ---------- Synchronisation ----------
let syncing = false;
async function sync(full = false) {
  if (!settings.proxyUrl || !navigator.onLine || syncing) return;
  syncing = true; $('#sync-btn').classList.add('busy'); $('#sync-icon').innerHTML = ico('refresh');
  try {
    for (const id of settings.pendingDeletes) { const r = await api(`/sync/tree/${id}`, { method: 'DELETE' }); if (r.ok) settings.pendingDeletes = settings.pendingDeletes.filter(x => x !== id); }
    const photos = await getAll('photos');
    for (const p of photos.filter(p => !p.synced)) { const r = await api(`/sync/photo/${p.id}`, { method: 'PUT', body: p.blob, headers: { 'Content-Type': 'image/jpeg' } }); if (r.ok) { p.synced = true; await put('photos', p); } }
    const local = await getAll('trees');
    for (const t of local.filter(t => !t.synced)) { const { synced, ...body } = t; const r = await api(`/sync/tree/${t.id}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }); if (r.ok) { t.synced = true; await put('trees', t); } }
    const r = await api('/sync/trees');
    if (r.ok) {
      const { trees } = await r.json(); const byId = Object.fromEntries((await getAll('trees')).map(t => [t.id, t]));
      const deleted = new Set(settings.pendingDeletes);
      for (const rt of trees) { if (deleted.has(rt.id)) continue; const lt = byId[rt.id]; if (!lt || (rt.updated || 0) > (lt.updated || 0)) await put('trees', Object.assign({}, rt, { synced: true })); }
      if (full) { const remote = new Set(trees.map(t => t.id)); for (const lt of Object.values(byId)) if (lt.synced && !remote.has(lt.id)) { await del('trees', lt.id); } }
    } else if (r.status === 500) toast('Cloud : binding KV manquant sur le Worker', 4000);
    else if (r.status === 401) toast('Cloud : mot de passe du relais incorrect', 4000);
    if (full) toast('Synchronisation terminée');
  } catch (e) { if (full) toast('Synchronisation impossible : ' + e.message); }
  syncing = false; $('#sync-btn').classList.remove('busy'); updateCount();
  if ($('#view-list').classList.contains('active')) renderList();
  if ($('#view-map').classList.contains('active')) renderMap();
}
$('#sync-btn').addEventListener('click', () => sync(true));
$('#btn-sync-full').addEventListener('click', () => sync(true));
window.addEventListener('online', () => sync());

// ---------- Liste ----------
$('#search').addEventListener('input', renderList);
async function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const all = (await getAll('trees')).sort((a, b) => b.date.localeCompare(a.date));
  const counts = {}; for (const t of all) counts[speciesName(t)] = (counts[speciesName(t)] || 0) + 1;
  $('#stats').innerHTML = `<span><b>${all.length}</b> arbres</span><span><b>${Object.keys(counts).length}</b> espèces</span>` + Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([n, c]) => `<span><b>${c}</b> ${esc(n)}</span>`).join('');
  const trees = q ? all.filter(t => (speciesName(t) + ' ' + (t.species.sci || '') + ' ' + (t.note || '')).toLowerCase().includes(q)) : all;
  const ul = $('#tree-list'); ul.innerHTML = '';
  for (const t of trees) {
    const li = document.createElement('li'); const pid = firstPhotoId(t);
    li.innerHTML = `<img class="thumb" src="icon.svg" alt=""><div class="info"><b><span class="dot" style="background:${colorFor(t.species.sci || speciesName(t))};display:inline-block;margin-right:6px"></span>${esc(speciesName(t))}</b><small>${esc(t.species.sci || '')}${t.species.score != null ? ' · ' + Math.round(t.species.score * 100) + ' %' : ''}</small><small>${new Date(t.date).toLocaleDateString('fr-FR')} · ±${(t.acc || 0).toFixed(0)} m${t.corrected ? ' · corrigé' : ''}${t.note ? ' · ' + esc(t.note) : ''}</small>${t.synced ? '' : `<small class="unsynced">${ico('clock')}non synchronisé</small>`}</div><button class="del" aria-label="Supprimer">${ico('trash')}</button>`;
    if (pid) photoSrc(pid).then(u => { if (u) li.querySelector('img').src = u; });
    li.querySelector('img').addEventListener('click', async () => { if (pid) { const u = await photoSrc(pid); if (u) { $('#viewer img').src = u; show($('#viewer')); } } });
    li.querySelector('.del').addEventListener('click', async () => {
      if (!confirm(`Supprimer ${speciesName(t)} ?`)) return;
      await del('trees', t.id); for (const o of t.organs || []) await del('photos', `${t.id}_${o}`);
      settings.pendingDeletes = [...settings.pendingDeletes, t.id];
      renderList(); updateCount(); sync();
    });
    ul.appendChild(li);
  }
}
$('#viewer button').addEventListener('click', () => show($('#viewer'), false));

// ---------- Carte ----------
let map, layer;
async function renderMap() {
  if (!hasLeaflet()) { $('#map').textContent = 'Carte indisponible hors ligne'; return; }
  if (!map) {
    map = L.map('map', { zoomControl: true });
    const ortho = L.tileLayer(IGN_ORTHO, { maxZoom: 21, maxNativeZoom: 19, attribution: 'IGN' }).addTo(map);
    const plan = L.tileLayer(IGN_PLAN, { maxZoom: 21, maxNativeZoom: 19, attribution: 'IGN' });
    L.control.layers({ 'Photo aérienne': ortho, 'Plan': plan }, null, { position: 'topright' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.setView([45.253, 5.245], 15);
    const me = L.circleMarker([0, 0], { radius: 7, color: '#fff', fillColor: '#1e6bff', fillOpacity: 1, weight: 2 });
    map.on('locationfound', e => { me.setLatLng(e.latlng).addTo(map); });
    map.locate({ watch: true, enableHighAccuracy: true, setView: false });
    const Loc = L.Control.extend({ onAdd() { const b = L.DomUtil.create('button', 'leaflet-bar'); b.innerHTML = ico('locate'); b.className += ' loc-btn'; b.onclick = () => { if (me._map) map.setView(me.getLatLng(), 19); else toast('Position en attente…'); }; return b; } });
    new Loc({ position: 'topleft' }).addTo(map);
  }
  layer.clearLayers();
  const trees = await getAll('trees'); const pts = []; const species = {};
  for (const t of trees) {
    const col = colorFor(t.species.sci || speciesName(t)); species[speciesName(t)] = col;
    const m = L.marker([t.lat, t.lon], { draggable: true, icon: L.divIcon({ className: '', html: `<div class="tree-marker" style="background:${col}"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(layer);
    m.bindPopup(`<b>${esc(speciesName(t))}</b><br><i>${esc(t.species.sci || '')}</i><br>±${(t.acc || 0).toFixed(0)} m${t.note ? '<br>' + esc(t.note) : ''}<div class="pp" data-id="${t.id}"></div>`);
    m.on('popupopen', async e => { const pid = firstPhotoId(t); if (!pid) return; const u = await photoSrc(pid); const box = e.popup.getElement().querySelector('.pp'); if (u && box) { box.innerHTML = `<img src="${u}">`; e.popup.update(); } });
    m.on('dragend', async () => { const ll = m.getLatLng(); t.lat = ll.lat; t.lon = ll.lng; t.corrected = true; t.updated = Date.now(); t.synced = false; await put('trees', t); haptic(); toast('Position corrigée'); sync(); });
    pts.push([t.lat, t.lon]);
  }
  $('#legend').innerHTML = Object.entries(species).sort().map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('');
  if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 19 });
  setTimeout(() => map.invalidateSize(), 50);
}

// ---------- Export ----------
$('#btn-export').addEventListener('click', async () => {
  const trees = await getAll('trees'); if (!trees.length) return toast('Rien à exporter');
  toast('Préparation du ZIP…', 6000);
  const geojson = { type: 'FeatureCollection', features: trees.map(t => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [t.lon, t.lat] }, properties: { id: t.id, date: t.date, common: t.species.common, scientific: t.species.sci, family: t.species.family || null, score: t.species.score, source: t.species.source, accuracy_m: +(t.acc || 0).toFixed(1), gps_lat: t.gpsLat, gps_lon: t.gpsLon, corrected: !!t.corrected, altitude: t.alt, note: t.note || '', photos: (t.organs || []).map(o => `photos/${t.id}_${o}.jpg`), candidates: t.apiRaw || null } })) };
  const zip = new JSZip();
  zip.file('arbres.geojson', JSON.stringify(geojson, null, 1));
  zip.file('arbres.csv', 'id;date;nom;nom_scientifique;score;lat;lon;precision_m;corrige;note\n' + trees.map(t => [t.id, t.date, speciesName(t), t.species.sci, t.species.score, t.lat, t.lon, (t.acc || 0).toFixed(1), t.corrected ? 1 : 0, (t.note || '').replace(/;/g, ',')].join(';')).join('\n'));
  for (const t of trees) for (const o of t.organs || []) { const id = `${t.id}_${o}`; await photoSrc(id); const p = await getOne('photos', id); if (p) zip.file(`photos/${id}.jpg`, p.blob); }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `arbres-roybon-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
  toast(`${trees.length} arbres exportés`);
});

// ---------- Réglages ----------
$('#btn-save-settings').addEventListener('click', () => { settings.proxyUrl = $('#proxy-url').value.trim(); settings.appToken = $('#app-token').value.trim(); settings.gpsSeconds = +$('#gps-seconds').value || 20; toast('Réglages enregistrés'); switchView('capture'); sync(true); });
$('#btn-wipe').addEventListener('click', async () => { if (!confirm('Effacer les données de ce téléphone ? Le cloud n\'est pas touché.')) return; await tx('trees', 'readwrite', s => s.clear()); await tx('photos', 'readwrite', s => s.clear()); updateCount(); toast('Données locales effacées'); });

// ---------- Init ----------
(async () => {
  await openDB();
  $('#proxy-url').value = settings.proxyUrl; $('#app-token').value = settings.appToken; $('#gps-seconds').value = settings.gpsSeconds;
  updateCount(); resetCapture();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!settings.proxyUrl) { toast('Commence par les Réglages : URL du relais et mot de passe', 4000); } else sync();
})();
