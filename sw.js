// Service Worker - Sin caché. Siempre carga desde la red.
const CACHE = 'mercaconsumo-v99-nocache';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Siempre va a la red. Nunca devuelve caché.
self.addEventListener('fetch', event => {
  // No interceptar peticiones a Supabase
  if (event.request.url.includes('supabase.co')) return;
  // Para todo lo demás, ir a la red directamente
  event.respondWith(fetch(event.request));
});
