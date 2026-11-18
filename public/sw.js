// TrackWise Service Worker v4
// KEY UPGRADES:
// 1. Strictly bypass service worker for all /api/* routes (network-only)
// 2. Never cache/serve HTML from cache — always fetch fresh so headers are delivered
// 3. Cache static assets (JS, CSS, icons) with stale-while-revalidate

const CACHE_NAME = 'trackwise-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
];

// Install: pre-cache static assets, activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: wipe ALL older caches (v1, v2, v3…) and claim tabs
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and non-http(s) (e.g. chrome-extension://)
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  // ── API Routes: Strictly Network-Only ─────────────────────────────────────
  // /api/auth/*, /api/auth/exchange, /api/auth/refresh, etc. MUST bypass cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // ── Navigation (HTML pages) ──────────────────────────────────────────────
  // Always go to network so COOP/COEP headers are fresh; offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // ── External / Google domains ────────────────────────────────────────────
  if (
    url.hostname.includes('google') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('accounts')
  ) {
    return;
  }

  // ── Static assets (JS / CSS / images) ───────────────────────────────────
  // Cache-first with background revalidation (stale-while-revalidate)
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const toCache = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, toCache));
          }
          return res;
        })
        .catch(() => null);

      return cached || networkFetch;
    })
  );
});
