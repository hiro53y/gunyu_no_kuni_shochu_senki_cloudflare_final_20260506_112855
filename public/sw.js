// 群雄ノ國：掌中戦記 v3.0 Service Worker（国盗り×迷宮）
// - APP SHELL は事前キャッシュ
// - 立ち絵 (/assets/portraits/) は network-first（新規追加が即反映されるため）
// - その他 GET リクエストは cache-first（バンドルアセット等）
// - 失敗レスポンス（4xx/5xx）はキャッシュしない

const CACHE_NAME = 'gunyu-no-kuni-v6-roguelike';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', cacheName: CACHE_NAME }))),
  );
});

function isOk(response) {
  return response && response.ok && response.status >= 200 && response.status < 300;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // 立ち絵とBGMは常に network-first（スマホ側の古い失敗キャッシュを避ける）
  if (requestUrl.pathname.startsWith('/assets/portraits/') ||
      requestUrl.pathname.startsWith('/assets/sounds/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (isOk(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || new Response('', { status: 404 }))),
    );
    return;
  }

  const isNavigation =
    event.request.mode === 'navigate' ||
    requestUrl.pathname === '/' ||
    requestUrl.pathname.endsWith('.html');
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (isOk(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html'))),
    );
    return;
  }

  if (requestUrl.pathname.startsWith('/assets/') && requestUrl.pathname.includes('/index-')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (isOk(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'));
    }),
  );
});
