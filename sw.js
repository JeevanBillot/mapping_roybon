/* Service worker : l'app se met à jour toute seule.
   - Fichiers de l'app : réseau d'abord (toujours la dernière version), cache si pas de réseau.
   - Bibliothèques versionnées (CDN) : cache d'abord.
   - Tuiles de carte IGN : réseau d'abord, cache pour le terrain sans réseau. */
const VERSION = 'v23';
const APP = 'app-' + VERSION, LIBS = 'libs', TILES = 'tiles';
const SHELL = ['./', './index.html', './style.css', './app.js', './manifest.json', './icon.svg', './data.js', './lidar.js', './house.js', './trees3d.js', './plan.html', './3d.html', ...['leaf_oak.png', 'leaf_ash.png', 'leaf_round.png', 'leaf_pine.png', ...['oak', 'pine', 'birch', 'willow'].flatMap(b => [`bark_${b}_color.jpg`, `bark_${b}_normal.jpg`])].map(f => './tex/' + f)];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];
// Un fichier indisponible ne bloque plus l'installation de la nouvelle version
const cacheAll = (name, urls) => caches.open(name).then(c => Promise.all(urls.map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok && c.put(u, r)).catch(() => {}))));

self.addEventListener('install', e => { e.waitUntil(Promise.all([cacheAll(APP, SHELL), cacheAll(LIBS, CDN)]).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![APP, LIBS, TILES].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) { const cp = r.clone(); caches.open(APP).then(c => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const cp = res.clone(); caches.open(LIBS).then(c => c.put(req, cp)); } return res; })));
    return;
  }
  if (url.hostname === 'data.geopf.fr' && url.pathname.startsWith('/wmts')) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(TILES).then(c => c.put(req, cp)); } return r; }).catch(() => caches.match(req)));
  }
  // Tout le reste (relais, Pl@ntNet, LiDAR, bâtiments) : réseau direct, sans cache
});
