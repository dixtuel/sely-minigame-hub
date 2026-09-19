// SELY.TR - High-Performance Low-Bandwidth Native Service Worker
// Versioned Cache Storage for Zero-Network Repeat Visits & Asset Optimization
const CACHE_NAME = "sely-cache-v1";

// Critical core assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/storage/logo-mark.png",
  "/storage/sely-mark_de9c08a5.png",
];

// 1. INSTALL: Pre-cache essential app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {
        // Fallback gracefully if precache fails
      })
  );
});

// 2. ACTIVATE: Purge stale caches from older deployments & claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. FETCH: Smart Network Egress Mitigation Strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ONLY handle GET requests — never touch mutations or POST requests
  if (request.method !== "GET") {
    return;
  }

  // A) NETWORK ONLY: Interactive game RPCs, case solving, mutations
  if (url.pathname.startsWith("/api/trpc")) {
    return;
  }

  // B) CACHE-FIRST: Content-addressed static assets (JS, CSS, Audio, 3D Textures, Google Fonts)
  const isImmutableAsset =
    url.pathname.startsWith("/assets/") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ogg") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg");

  if (isImmutableAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // C) STALE-WHILE-REVALIDATE: Game posters, icons & banners (/storage/*)
  const isPosterOrStorage = url.pathname.startsWith("/storage/");

  if (isPosterOrStorage) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // D) NETWORK-FIRST with CACHE FALLBACK: HTML documents and general API queries
  if (request.mode === "navigate" || url.pathname.startsWith("/api/config") || url.pathname.startsWith("/api/leaderboard")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
});
