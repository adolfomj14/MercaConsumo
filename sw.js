// Service Worker - Sin interferencia con APIs externas
const CACHE = 'mercaconsumo-v102-nocache';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    return;
  }
  event.respondWith(fetch(event.request));
});
