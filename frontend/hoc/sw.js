// Student shell only: never intercept API requests, identity or teacher pages.
const CACHE = 'aisgk-student-shell-45e3a248b05e7c2e25066bb3';
const FILES = ['./', './index.html', './styles.css', './app.js', './api.js', './db.js', './dom.js', './exam.js', './fb.js', './exam-fb.js', './thi-app.js', './thi-store.js', './presence.js', './presence-config.js', './sheet-config.js', './typing.js', './read-progress.js', './support.js', './support-config.js', './mastery.js', './quiz-play.js', './manifest.webmanifest', './fonts/source-serif-4-latin-wght-normal.woff2', './fonts/source-serif-4-vietnamese-wght-normal.woff2', './fonts/nunito-latin-wght-normal.woff2', './fonts/nunito-vietnamese-wght-normal.woff2', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];
const ALLOWED = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(FILES.map(async path => {
    try {
      const response = await fetch(path, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(path, response);
    } catch (err) {
      console.warn('[SW] Bỏ qua tài nguyên không tải được khi cài đặt:', path, err.message);
    }
  }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!ALLOWED.has(url.href) && !ALLOWED.has(url.pathname)) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => {
    if (cached) return cached;
    return fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    });
  }));
});
