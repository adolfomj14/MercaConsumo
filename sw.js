// Service Worker - Sin interferencia con APIs externas
const CACHE = 'mercaconsumo-v100-nocache';

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
  // Ignorar cualquier petición que no sea del mismo dominio local (Supabase, Google Gemini, CDNs, etc.)
  if (url.origin !== location.origin) {
    return;
  }
  // Para archivos estáticos locales, siempre ir a la red directamente
  event.respondWith(fetch(event.request));
});
