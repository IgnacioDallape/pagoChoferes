const CACHE = 'sueldo-choferes-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Serif+Display&display=swap'
];

// Install: pre-cache all app shell assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin, network-first for fonts
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Google Fonts: network-first with cache fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Same-origin: cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        });
      })
    );
  }
});
