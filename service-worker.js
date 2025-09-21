const CACHE = 'ai-hoops-mvp-v2'; // <- 改个新版本号

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  // 新增：把新页面也缓存
  './pages/library.html',
  './pages/drills.html'
];


self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (ASSETS.includes(url.pathname) || url.origin===location.origin){
    e.respondWith(
      caches.match(e.request).then(res=> res || fetch(e.request).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return resp;
      }))
    );
  }
});
