/// Service Worker — Trustcare Hospital Network
/// Cache-first strategy for static assets (avatars, vendor chunks)

const CACHE_NAME = "trustcare-sw-v1";

// Patterns to cache with cache-first strategy
const CACHE_FIRST_PATTERNS = [
  /\/manus-storage\//,       // Avatar images & uploaded assets
  /\/assets\/vendor-/,       // Vendor chunks (react, trpc, ui)
  /\.woff2?$/,               // Web fonts
];

// Patterns to skip caching entirely
const NO_CACHE_PATTERNS = [
  /\/api\//,                  // API calls
  /\/trpc\//,                // tRPC calls
  /\/__manus__\//,           // Debug collector
  /hot-update/,             // HMR updates
];

self.addEventListener("install", (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all clients immediately
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip non-cacheable patterns
  if (NO_CACHE_PATTERNS.some((p) => p.test(url.pathname))) return;

  // Cache-first for matching patterns
  if (CACHE_FIRST_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            // Only cache successful responses
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // Network-first for everything else (HTML, app JS)
  // Don't intercept — let browser handle normally
});
