// DLFI Service Worker — minimal offline cache for the core shell.
const CACHE = 'dlfi-shell-v1';
const ASSETS = [
  'DLFI.html',
  'dlfi-styles.css',
  'dlfi-recruitment.css',
  'dlfi-extras.css',
  'dlfi-app.js',
  'dlfi-audio.js',
  'dlfi-extras.js',
  'dlfi-recruitment.js',
  'manifest.json',
  'img/pwa-icon-192.svg',
  'img/pwa-icon-512.svg'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  // Only handle same-origin GETs
  if (ev.request.method !== 'GET' || url.origin !== self.location.origin) return;
  ev.respondWith(
    caches.match(ev.request).then((hit) => {
      if (hit) {
        // Background revalidate
        fetch(ev.request).then((res) => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(ev.request, res));
        }).catch(() => {});
        return hit;
      }
      return fetch(ev.request).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(ev.request, copy));
        }
        return res;
      }).catch(() => caches.match('DLFI.html'));
    })
  );
});
