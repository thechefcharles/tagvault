/**
 * TagVault PWA Service Worker - Conservative caching
 * - Precaches: manifest, icons only
 * - All other requests: network-only (no cache)
 * - Explicit bypass: /api/*, /auth/*, requests with credentials
 */
const PRECACHE = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const CACHE_NAME = 'tagvault-pwa-v1';

function shouldBypassCache(url) {
  const u = new URL(url);
  if (u.pathname.startsWith('/api/')) return true;
  if (u.pathname.startsWith('/auth/')) return true;
  if (u.pathname.includes('/monitoring')) return true; // Sentry
  return false;
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (shouldBypassCache(e.request.url)) return;
  if (e.request.credentials === 'include') return;

  const url = new URL(e.request.url);
  const path = url.pathname;
  const isPrecached = PRECACHE.some((p) => path === p);
  if (!isPrecached) return;

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
