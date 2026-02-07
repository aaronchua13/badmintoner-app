const CACHE_NAME = 'badminton-queue-v1';
const URLS_TO_CACHE = [
  '/queuing',
  '/manifest.json',
  '/file.svg',
  '/globe.svg',
  '/next.svg',
  '/vercel.svg',
  '/window.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Force cache /queuing and assets
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  // Force activation immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Strategy: Stale-While-Revalidate for /queuing and same-origin assets
  // This ensures offline works (stale) but updates happen in background
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            // Update cache with new response
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Network failed, nothing to do (we rely on cache)
          });

          // Return cached response immediately if available, else wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
