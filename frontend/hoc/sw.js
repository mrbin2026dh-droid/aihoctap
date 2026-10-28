// Student shell only: never intercept API requests, identity or teacher pages.
const CACHE = 'aisgk-student-shell-8fd1a5f804c9e9b24f9986c9';
const FILES = ['./', './index.html', './styles.css', './app.js', './api.js', './db.js', './dom.js', './exam.js', './fb.js', './exam-fb.js', './thi-app.js', './thi-store.js', './presence.js', './presence-config.js', './sheet-config.js', './typing.js', './read-progress.js', './support.js', './support-config.js', './help-faq.js', './mastery.js', './quiz-play.js', './manifest.webmanifest', './fonts/source-serif-4-latin-wght-normal.woff2', './fonts/source-serif-4-vietnamese-wght-normal.woff2', './fonts/nunito-latin-wght-normal.woff2', './fonts/nunito-vietnamese-wght-normal.woff2', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];
const ALLOWED = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(FILES.map(async path => {
    const response = await fetch(new Request(path, { cache: 'reload' }));
    if (!response.ok) throw new Error(`Không nạp được ${path}: ${response.status}`);
    await cache.put(new Request(path), response);
  }))));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('aisgk-student-shell-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE') self.skipWaiting();
  if (event.data?.type === 'VERSION') event.source.postMessage({type: 'VERSION', value: CACHE.slice(-8)});
});
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate' && new URL(event.request.url).origin === self.location.origin) {
    const url = new URL(event.request.url);
    const scope = new URL(self.registration.scope);
    if (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html') {
      event.respondWith(caches.open(CACHE).then(async c => (await c.match(new URL('./index.html', scope).href)) || fetch(event.request)));
      return;
    }
  }
  if (event.request.method !== 'GET' || !ALLOWED.has(event.request.url)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    return cached || fetch(event.request);
  }));
});
