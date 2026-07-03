/// Service Worker — Trustcare Hospital Network
/// Network-first for person images, cache-first for immutable static assets

const CACHE_NAME = "trustcare-sw-v5-person-images";

// Patterns to cache with cache-first strategy
const CACHE_FIRST_PATTERNS = [
  /\/assets\/vendor-/,       // Vendor chunks (react, trpc, ui)
  /\.woff2?$/,               // Web fonts
];

// Uploaded photos: network-first with redirect handling.
// In production the platform returns 307 → CloudFront (cross-origin).
// We must NOT intercept these — let the browser handle the redirect natively
// so that <img> tags follow the 307 transparently.
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
  // In production, these return 307 redirects to CloudFront signed URLs.
  // If the service worker intercepts them, the cross-origin redirect produces
  // an opaque response that breaks <img> rendering in Chrome.
  // Let the browser handle these natively — it follows 307 correctly.
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
