// Incrementar VERSION cada vez que se despliega un cambio
const VERSION = 5;
const CACHE = `sueldo-choferes-v${VERSION}`;

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

// Install: pre-cache todos los assets y activar de inmediato
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // no esperar a que cierren las pestañas anteriores
});

// Activate: borrar caches viejos y tomar control de todas las pestañas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // dispara controllerchange en la página → auto-reload
});

// Fetch: cache-first para assets propios, network-first para fuentes
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Google Fonts: network-first con fallback a cache
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

  // Same-origin: cache-first, actualiza cache en background
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then(cached => {
        const fetchAndCache = fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return res;
        });
        return cached || fetchAndCache;
      })
    );
  }
});
