// Service worker: l'app s'instal·la al mòbil i funciona sense connexió amb l'última agenda baixada.
const CACHE = 'activitats-v1';
const ESTATICS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESTATICS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Xarxa primer (dades i pàgina sempre fresques); si no hi ha connexió, la còpia desada.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const clau = url.pathname.endsWith('activitats.json') ? new Request(url.origin + url.pathname) : e.request;
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(clau, c)); } return r; })
      .catch(() => caches.match(clau))
  );
});
