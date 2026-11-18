// TrackWise Service Worker v3
// KEY FIX: Never cache/serve HTML from cache — always fetch fresh so the
// server's Cross-Origin-Opener-Policy header is delivered to the browser,
// which is required for Google Identity Services (GIS) popup login to work.
const CACHE_NAME = 'trackwise-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Install: pre-cache only static non-HTML assets, then activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: wipe ALL old caches (v1, v2…) and claim all open tabs at once
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

  // ── Navigation (HTML pages) ──────────────────────────────────────────────
  // ALWAYS go to the network so the COOP/COEP headers from Vite / Vercel are
  // delivered fresh. Only fall back to a cached shell when truly offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // ── External / Google domains ────────────────────────────────────────────
  // Never intercept: let the browser handle Google Auth, fonts, APIs directly.
  try {
    const { hostname } = new URL(request.url);
    if (
      hostname.includes('google') ||
      hostname.includes('googleapis') ||
      hostname.includes('gstatic') ||
      hostname.includes('accounts')
    ) {
      return;
    }
  } catch (_) {
    return;
  }

  // ── Static assets (JS / CSS / images) ───────────────────────────────────
  // Cache-first with background revalidation (stale-while-revalidate).
  event.respondWith(
    caches.match(request).then((cached) => {
      // Background update for next visit
      const networkFetch = fetch(request).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const toCache = res.clone(); // clone BEFORE consuming
          caches.open(CACHE_NAME).then((c) => c.put(request, toCache));
        }
        return res;
      }).catch(() => null);

      return cached || networkFetch;
    })
  );
});
