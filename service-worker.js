// service-worker.js
const CACHE = 'ai-hoops-mvp-v24';

// ✅ 不要把 plays.json 放进预缓存，避免读到旧表
const ASSETS = [
  './',
  './index.html',
  './main.js',
  './service-worker.js',
  './manifest.json',
  './assets/icon-192.png',
  './pages/library.html',
  './pages/drills.html',
  // './plays/plays.json',  // ← 移除
  './plays/presets.js'
];

self.addEventListener('install', (e) => {
  // 新 SW 安装时预缓存静态资源
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  // 清理旧缓存，并让新 SW 立刻接管
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // ✅ 对 plays.json 永远走网络（不读缓存、不写缓存），并兜底空数组
  if (url.origin === location.origin && url.pathname.endsWith('/plays/plays.json')) {
    e.respondWith((async () => {
      try {
        const noStoreReq = new Request(req.url, { cache: 'no-store' });
        return await fetch(noStoreReq);
      } catch {
        return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // 本站其他静态资源：Cache-First（离线可用）
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const resp = await fetch(req);
      // 放入缓存（同源 GET）
      if (req.method === 'GET') {
        const cache = await caches.open(CACHE);
        cache.put(req, resp.clone());
      }
      return resp;
    })());
    return;
  }

  // 第三方请求：网络优先，失败再看缓存
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
