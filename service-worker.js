const STATIC_CACHE = 'ai-hoops-static-v27';
const CATALOG_CACHE = 'ai-hoops-catalog-v1';
const CATALOG_PATHS = new Set(['/plays/plays.json', '/drills/drills.json']);

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './service-worker.js',
  './manifest.json',
  './assets/icon-192.png',
  './pages/library.html',
  './pages/drills.html',
  './pages/settings.html',
  './plays/presets.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, CATALOG_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function makeCatalogKey(url) {
  return new Request(`${url.origin}${url.pathname}`);
}

async function isValidCatalogResponse(response) {
  if (!response || !response.ok) return false;
  try {
    const payload = await response.clone().json();
    return Array.isArray(payload);
  } catch (_) {
    return false;
  }
}

async function fetchCatalogAndRefresh(request, cache, key) {
  try {
    const response = await fetch(new Request(request.url, { cache: 'no-store' }));
    if (!await isValidCatalogResponse(response)) return null;
    await cache.put(key, response.clone());
    return response;
  } catch (_) {
    return null;
  }
}

async function handleCatalogRequest(request, event) {
  const url = new URL(request.url);
  const cache = await caches.open(CATALOG_CACHE);
  const key = makeCatalogKey(url);
  const cached = await cache.match(key);
  const networkPromise = fetchCatalogAndRefresh(request, cache, key);

  if (cached) {
    if (event) event.waitUntil(networkPromise);
    return cached;
  }

  const fresh = await networkPromise;
  if (fresh) return fresh;

  return new Response(JSON.stringify({ error: 'catalog-unavailable', path: url.pathname }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin === location.origin && CATALOG_PATHS.has(url.pathname)) {
    event.respondWith(handleCatalogRequest(request, event));
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (request.method === 'GET') {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })());
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
