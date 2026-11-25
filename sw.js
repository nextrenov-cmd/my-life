// オフライン対応：アプリ本体を端末にキャッシュする（記録データは IndexedDB に保存）
const VERSION = 'mylife-v2';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/core.js',
  './js/db.js',
  './js/util.js',
  './js/knowledge.js',
  './js/experts.js',
  './js/planner.js',
  './js/analysis.js',
  './js/backup.js',
  './js/ai.js',
  './js/views/setup.js',
  './js/views/today.js',
  './js/views/future.js',
  './js/views/review.js',
  './js/views/more.js',
  './js/views/todo.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// キャッシュを優先して即表示し、裏で最新版に更新する
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
