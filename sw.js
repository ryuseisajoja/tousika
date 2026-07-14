// ビリオンバトル PWA Service Worker
// 方針:
//  - ページ(HTML)はネットワーク優先（常に最新を取りに行き、オフライン時のみキャッシュ）
//    → ローカルモードはオフラインでも遊べる。アップデートも自然に反映される。
//  - アイコン等の静的ファイルはキャッシュ優先。
//  - Firebase / Google認証への通信は一切キャッシュしない（オンライン対戦はリアルタイムが命）。
const CACHE = 'biribato-v8';
const CORE = ['./index.html', './rules.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // 外部API（Firebase・認証など）はSWを素通し
  if (url.origin !== location.origin) return;

  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    // HTML: ネットワーク優先 → 失敗時キャッシュ（オフラインでもローカルモードが起動）
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true })
          .then(m => m || caches.match('./index.html')))
    );
  } else {
    // 静的ファイル: キャッシュ優先 → なければネットワーク
    e.respondWith(
      caches.match(e.request).then(m => m || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
    );
  }
});
