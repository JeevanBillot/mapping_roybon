/* Arbres du Pré Reynaud — collecte terrain (PWA) */
'use strict';

// ---------- IndexedDB ----------
const DB_NAME = 'arbres', DB_VER = 1;
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      d.createObjectStore('trees', { keyPath: 'id' });
      d.createObjectStore('photos', { keyPath: 'id' }); // {id, treeId, organ, blob}
    };
    r.onsuccess = e => { db = e.target.result; res(db); };
    r.onerror = e => rej(e);
  });
}
function tx(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = e => rej(e);
  });
}
const getAll = store => new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = rej; });
const put = (store, v) => tx(store, 'readwrite', s => s.put(v));
const del = (store, k) => tx(store, 'readwrite', s => s.delete(k));

// ---------- Settings ----------
const settings = {
  get proxyUrl() { return (localStorage.getItem('proxyUrl') || '').replace(/\/+$/, ''); },
  set proxyUrl(v) { localStorage.setItem('proxyUrl', v); },
  get appToken() { return localStorage.getItem('appToken') || ''; },
  set appToken(v) { localStorage.setItem('appToken', v); },
  get gpsSeconds() { return +(localStorage.getItem('gpsSeconds') || 15); },
  set gpsSeconds(v) { localStorage.setItem('gpsSeconds', v); },
};

// ---------- UI helpers ----------
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function toast(msg, ms = 2500) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), ms); }
function show(el, on = true) { el.classList.toggle('hidden', !on); }

$$('nav button').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
function switchView(v) {
  $$('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'list') renderList();
  if (v === 'map') renderMap();
}

// ---------- État de saisie ----------
let current = null; // {id, lat, lon, acc, samples, photos:{organ:Blob}, species, ...}
function resetCapture() {
  current = null;
  show($('#step-gps')); show($('#gps-status'), false);
  show($('#step-photos'), false); show($('#step-save'), false); show($('#btn-cancel'), false);
  $$('.photo-slot').forEach(s => { s.classList.remove('filled'); s.querySelector('img').src = ''; s.querySelector('input').value = ''; });
  $('#results').innerHTML = ''; show($('#manual'), false); show($('#id-status'), false);
  $('#btn-identify').disabled = true; $('#note').value = ''; $('#manual-species').value = '';
}
$('#btn-cancel').addEventListener('click', () => { if (confirm('Abandonner cet arbre ?')) resetCapture(); });

// ---------- GPS moyenné ----------
$('#btn-gps').addEventListener('click', async () => {
  if (!navigator.geolocation) return toast('Pas de GPS disponible');
  const dur = settings.gpsSeconds * 1000;
  const samples = [];
  show($('#gps-status')); $('#btn-gps').disabled = true;
  $('#gps-text').textContent = 'Acquisition…';
  const t0 = Date.now();
  await new Promise(resolve => {
    let done = false;
    const onPos = p => {
      if (done) return;
      samples.push({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, t: p.timestamp });
      const el = Date.now() - t0;
      $('#gps-bar').style.width = Math.min(100, el / dur * 100) + '%';
      $('#gps-text').textContent = `${samples.length} mesures · précision ${p.coords.accuracy.toFixed(0)} m`;
    };
    const opts = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
    const wid = navigator.geolocation.watchPosition(onPos, err => toast('Erreur GPS : ' + err.message), opts);
    // Sondage 1 s en complément : watchPosition ne remonte rien si la position ne bouge pas
    const iv = setInterval(() => navigator.geolocation.getCurrentPosition(onPos, () => {}, opts), 1000);
    setTimeout(() => { done = true; navigator.geolocation.clearWatch(wid); clearInterval(iv); resolve(); }, dur);
  });
  $('#btn-gps').disabled = false;
  if (!samples.length) { show($('#gps-status'), false); return toast('Aucune position reçue'); }
  // Moyenne pondérée par 1/acc², en écartant les mesures > 2x la médiane
  const accs = samples.map(s => s.acc).sort((a, b) => a - b);
  const med = accs[Math.floor(accs.length / 2)];
  const good = samples.filter(s => s.acc <= med * 2);
  let W = 0, lat = 0, lon = 0, alt = 0, nAlt = 0;
  for (const s of good) { const w = 1 / (s.acc * s.acc); W += w; lat += s.lat * w; lon += s.lon * w; if (s.alt != null) { alt += s.alt; nAlt++; } }
  lat /= W; lon /= W;
  const acc = Math.sqrt(1 / W);
  current = { id: Date.now().toString(36), lat, lon, acc, accMin: accs[0], samples: good.length, alt: nAlt ? alt / nAlt : null, date: new Date().toISOString(), photos: {} };
  $('#pos-text').textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)} · ±${acc.toFixed(1)} m (${good.length} mesures)`;
  show($('#step-gps'), false); show($('#step-photos')); show($('#btn-cancel'));
  if (accs[0] > 15) toast('Précision faible, tu pourras corriger sur la carte', 4000);
});

// ---------- Photos ----------
function downscale(file, max = 1280) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(img.src); res(b); }, 'image/jpeg', 0.85);
    };
    img.src = URL.createObjectURL(file);
  });
}
$$('.photo-slot input').forEach(inp => inp.addEventListener('change', async () => {
  const f = inp.files[0]; if (!f || !current) return;
  const slot = inp.closest('.photo-slot');
  const blob = await downscale(f);
  current.photos[slot.dataset.organ] = blob;
  slot.querySelector('img').src = URL.createObjectURL(blob);
  slot.classList.add('filled');
  $('#btn-identify').disabled = false;
}));

// ---------- Pl@ntNet ----------
const ORGAN_MAP = { leaf: 'leaf', bark: 'bark', habit: 'habit', fruit: 'fruit' };
$('#btn-identify').addEventListener('click', identify);
async function identify() {
  if (!settings.proxyUrl) { toast('Renseigne l\'URL du relais dans ⚙'); return switchView('settings'); }
  const organs = Object.keys(current.photos);
  if (!organs.length) return toast('Ajoute au moins une photo');
  const fd = new FormData();
  for (const o of organs) { fd.append('images', current.photos[o], o + '.jpg'); fd.append('organs', ORGAN_MAP[o]); }
  const st = $('#id-status'); show(st); st.textContent = 'Identification en cours…';
  $('#btn-identify').disabled = true; $('#results').innerHTML = '';
  try {
    const url = `${settings.proxyUrl}?lang=fr&nb-results=5&include-related-images=true`;
    const headers = settings.appToken ? { 'X-App-Token': settings.appToken } : {};
    const r = await fetch(url, { method: 'POST', body: fd, headers });
    if (r.status === 404) { st.textContent = 'Aucune espèce reconnue. Ajoute une autre photo (feuille de préférence) ou saisis à la main.'; return; }
    if (!r.ok) {
      let msg = ''; try { const j = await r.json(); msg = j.message || j.error || JSON.stringify(j); } catch (e) { msg = await r.text().catch(() => ''); }
      st.textContent = `Erreur API ${r.status}${msg ? ' : ' + msg : ''}` + (r.status === 401 || r.status === 403 ? ' — vérifie le relais et son mot de passe dans ⚙' : r.status === 429 ? ' — quota du jour dépassé' : '');
      return;
    }
    const data = await r.json();
    current.apiRaw = data.results.slice(0, 5).map(x => ({ sci: x.species.scientificNameWithoutAuthor, score: x.score, common: x.species.commonNames }));
    show(st, false);
    renderResults(data.results.slice(0, 5));
  } catch (e) {
    st.textContent = 'Réseau indisponible. Saisis l\'espèce à la main, ou réessaie plus tard (les photos sont conservées).';
  } finally { $('#btn-identify').disabled = false; }
}
function renderResults(results) {
  const ul = $('#results'); ul.innerHTML = '';
  for (const x of results) {
    const li = document.createElement('li');
    const img = (x.images && x.images[0] && x.images[0].url && x.images[0].url.s) || '';
    const common = (x.species.commonNames || [])[0] || '';
    li.innerHTML = `<img src="${img}" alt=""><div class="name"><b>${common || x.species.scientificNameWithoutAuthor}</b><i>${x.species.scientificNameWithoutAuthor}</i></div><div class="score">${Math.round(x.score * 100)} %</div>`;
    li.addEventListener('click', () => choose({ common, sci: x.species.scientificNameWithoutAuthor, family: x.species.family && x.species.family.scientificNameWithoutAuthor, score: x.score, source: 'plantnet' }));
    ul.appendChild(li);
  }
  const li = document.createElement('li');
  li.innerHTML = `<div class="name"><b>Aucun ne convient</b><i>Reprendre une photo ou saisir à la main</i></div>`;
  li.addEventListener('click', () => toast('Ajoute ou remplace une photo, puis Identifier'));
  ul.appendChild(li);
}
$('#btn-manual').addEventListener('click', () => { show($('#manual')); $('#manual-species').focus(); });
$('#btn-manual-ok').addEventListener('click', () => {
  const v = $('#manual-species').value.trim(); if (!v) return;
  choose({ common: v, sci: '', score: null, source: 'manuel' });
});
function choose(sp) {
  current.species = sp;
  $('#chosen-text').textContent = `${sp.common || sp.sci}${sp.sci && sp.common ? ' (' + sp.sci + ')' : ''}${sp.score != null ? ' · ' + Math.round(sp.score * 100) + ' %' : ''}`;
  show($('#step-photos'), false); show($('#step-save'));
}
$('#btn-back').addEventListener('click', () => { show($('#step-save'), false); show($('#step-photos')); });

// ---------- Enregistrement ----------
$('#btn-save').addEventListener('click', async () => {
  current.note = $('#note').value.trim();
  const { photos, ...tree } = current;
  tree.organs = Object.keys(photos);
  await put('trees', tree);
  for (const o of tree.organs) await put('photos', { id: `${tree.id}_${o}`, treeId: tree.id, organ: o, blob: photos[o] });
  toast('Arbre enregistré ✔');
  resetCapture(); updateCount();
});
async function updateCount() { $('#count').textContent = (await getAll('trees')).length; }

// ---------- Liste ----------
async function renderList() {
  const trees = (await getAll('trees')).sort((a, b) => b.date.localeCompare(a.date));
  const photos = await getAll('photos');
  const ul = $('#tree-list'); ul.innerHTML = '';
  for (const t of trees) {
    const p = photos.find(x => x.treeId === t.id && x.organ === 'leaf') || photos.find(x => x.treeId === t.id);
    const li = document.createElement('li');
    li.innerHTML = `<img src="${p ? URL.createObjectURL(p.blob) : 'icon.svg'}" alt=""><div class="info"><b>${t.species.common || t.species.sci}</b><small>${t.species.sci || ''}</small><small>${t.lat.toFixed(5)}, ${t.lon.toFixed(5)} ±${t.acc.toFixed(0)} m${t.note ? ' · ' + t.note : ''}</small></div><button>✕</button>`;
    li.querySelector('button').addEventListener('click', async () => {
      if (!confirm('Supprimer cet arbre ?')) return;
      await del('trees', t.id);
      for (const ph of photos.filter(x => x.treeId === t.id)) await del('photos', ph.id);
      renderList(); updateCount();
    });
    ul.appendChild(li);
  }
}

// ---------- Carte ----------
let map, layer;
async function renderMap() {
  if (!map) {
    map = L.map('map', { zoomControl: true });
    L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg',
      { maxZoom: 20, maxNativeZoom: 19, attribution: 'IGN' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.setView([45.253, 5.245], 15); // Roybon
    map.locate({ setView: false, enableHighAccuracy: true });
    map.on('locationfound', e => { L.circleMarker(e.latlng, { radius: 6, color: '#1e6bff' }).addTo(map); });
  }
  layer.clearLayers();
  const trees = await getAll('trees');
  const pts = [];
  for (const t of trees) {
    const m = L.marker([t.lat, t.lon], { draggable: true }).addTo(layer);
    m.bindPopup(`<b>${t.species.common || t.species.sci}</b><br>${t.species.sci || ''}<br>±${t.acc.toFixed(0)} m`);
    m.on('dragend', async () => {
      const ll = m.getLatLng();
      t.lat = ll.lat; t.lon = ll.lng; t.corrected = true;
      await put('trees', t); toast('Position corrigée');
    });
    L.circle([t.lat, t.lon], { radius: t.acc, color: '#a8d5a2', weight: 1, fillOpacity: .1 }).addTo(layer);
    pts.push([t.lat, t.lon]);
  }
  if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 19 });
  setTimeout(() => map.invalidateSize(), 50);
}

// ---------- Export ----------
$('#btn-export').addEventListener('click', async () => {
  const trees = await getAll('trees');
  if (!trees.length) return toast('Rien à exporter');
  const photos = await getAll('photos');
  const geojson = {
    type: 'FeatureCollection',
    features: trees.map(t => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
      properties: {
        id: t.id, date: t.date, common: t.species.common, scientific: t.species.sci, family: t.species.family || null,
        score: t.species.score, source: t.species.source, accuracy_m: +t.acc.toFixed(1), gps_samples: t.samples,
        altitude: t.alt, corrected: !!t.corrected, note: t.note || '',
        photos: t.organs.map(o => `photos/${t.id}_${o}.jpg`), candidates: t.apiRaw || null
      }
    }))
  };
  const zip = new JSZip();
  zip.file('arbres.geojson', JSON.stringify(geojson, null, 1));
  zip.file('arbres.csv', 'id;date;nom;nom_scientifique;score;lat;lon;precision_m;note\n' +
    trees.map(t => [t.id, t.date, t.species.common, t.species.sci, t.species.score, t.lat, t.lon, t.acc.toFixed(1), (t.note || '').replace(/;/g, ',')].join(';')).join('\n'));
  for (const p of photos) zip.file(`photos/${p.id}.jpg`, p.blob);
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `arbres-pre-reynaud-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  toast(`${trees.length} arbres exportés`);
});

// ---------- Réglages ----------
$('#btn-save-settings').addEventListener('click', () => {
  settings.proxyUrl = $('#proxy-url').value.trim();
  settings.appToken = $('#app-token').value.trim();
  settings.gpsSeconds = +$('#gps-seconds').value || 15;
  toast('Réglages enregistrés'); switchView('capture');
});
$('#btn-wipe').addEventListener('click', async () => {
  if (!confirm('Effacer TOUS les arbres et photos ? Exporte d\'abord !')) return;
  await tx('trees', 'readwrite', s => s.clear()); await tx('photos', 'readwrite', s => s.clear());
  updateCount(); toast('Base vidée');
});

// ---------- Init ----------
(async () => {
  await openDB();
  $('#proxy-url').value = settings.proxyUrl; $('#app-token').value = settings.appToken; $('#gps-seconds').value = settings.gpsSeconds;
  updateCount(); resetCapture();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!settings.proxyUrl) toast('Commence par saisir l\'URL du relais dans ⚙', 4000);
})();
