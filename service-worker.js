// service-worker.js
// 版本号每次改动都要 +1，才能触发客户端更新
const CACHE = 'ai-hoops-mvp-v14';

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './pages/library.html',
  './pages/drills.html',
  // 新增：数据与预设
  './plays/plays.json',
  './drills/drills.json',
  './plays/presets.js'
];


self.addEventListener('install', (e) => {
  // 新 SW 安装时预缓存静态资源
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  // 清理旧缓存，并让新 SW 立刻接管
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 对本站静态资源：Cache-First（离线可用）
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return resp;
        });
      })
    );
    return;
  }

  // 第三方请求（如图片、字体等）：网络优先，失败再看缓存
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
