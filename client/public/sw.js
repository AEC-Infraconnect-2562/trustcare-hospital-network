/// Service Worker — Trustcare Hospital Network
/// Cache-first for immutable static assets, network-first for person images

const CACHE_NAME = "trustcare-sw-v4-person-images";

// Patterns to cache with cache-first strategy
const CACHE_FIRST_PATTERNS = [
  /\/assets\/vendor-/,       // Vendor chunks (react, trpc, ui)
  /\.woff2?$/,               // Web fonts
];

// Uploaded photos can change independently from the app build and must not keep
// stale 404/error bodies on mobile browsers.
const IMAGE_NETWORK_FIRST_PATTERNS = [
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

  // Network-first for Manus storage images. If the network is unavailable,
  // fall back to the last known good image response.
  if (IMAGE_NETWORK_FIRST_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request, { cache: "no-store" });
          const contentType = response.headers.get("content-type") || "";
          if (response.ok && contentType.startsWith("image/")) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw error;
        }
      })
    );
    return;
  }

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
