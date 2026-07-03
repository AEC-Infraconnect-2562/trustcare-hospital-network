/// Service Worker — Trustcare Hospital Network
/// Network-first for person images, cache-first for immutable static assets

const CACHE_NAME = "trustcare-sw-v6-streaming";

// Patterns to cache with cache-first strategy
const CACHE_FIRST_PATTERNS = [
  /\/assets\/vendor-/,       // Vendor chunks (react, trpc, ui)
  /\.woff2?$/,               // Web fonts
];

// Uploaded photos: bypass service worker entirely.
// The server now streams file bytes directly (same-origin), no more 307 redirect.
// We still skip SW interception to avoid unnecessary caching of large images.
const IMAGE_BYPASS_PATTERNS = [
  /\/manus-storage\//,
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
  // Claim all clients immediately and purge old caches
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

  // DO NOT intercept manus-storage requests.
  // Server streams bytes directly (same-origin), but we skip SW to avoid
  // caching potentially large image/document files in the SW cache.
  if (IMAGE_BYPASS_PATTERNS.some((p) => p.test(url.pathname))) return;

  // Cache-first for matching patterns (vendor chunks, fonts)
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
