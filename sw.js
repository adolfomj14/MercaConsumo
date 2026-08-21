const CACHE_NAME = 'mercaconsumo-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './js/app.js',
  './js/config.js',
  './js/state.js',
  './js/services/supabase.js',
  './js/services/auth.js',
  './js/services/products.js',
  './js/services/stores.js',
  './js/services/purchases.js',
  './js/services/inventory.js',
  './js/services/ocr.js',
  './js/services/demoData.js',
  './js/utils/formatters.js',
  './js/utils/unitConverter.js',
  './js/utils/matcher.js',
  './js/utils/forecasting.js',
  './js/utils/toast.js',
  './js/views/authView.js',
  './js/views/dashboardView.js',
  './js/views/purchasesView.js',
  './js/views/inventoryView.js',
  './js/views/statsView.js',
  './js/views/scanView.js',
  './js/views/settingsView.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo cacheamos peticiones GET a recursos estáticos locales
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Peticiones a Supabase o CDN externas van por red primero
  if (url.origin !== location.origin || url.pathname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return response;
      });
    })
  );
});
