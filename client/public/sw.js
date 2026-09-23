// SELY.TR - High-Performance Cross-Platform PWA Service Worker
// Desktop (Chrome, Edge, Brave, Vivaldi, Opera, Linux Chromium) + Mobile (iOS, Android)
// Versioned Cache Storage, Offline Fallback, SW Update Lifecycle
const CACHE_NAME = "sely-pwa-v4";

// Critical core assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-48x48.png",
  "/icons/icon-96x96.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png",
];

// Offline fallback page (served when network is unavailable for navigation)
const OFFLINE_FALLBACK = "/";

// 1. INSTALL: Pre-cache essential app shell, activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {
        // Fallback gracefully if precache fails (e.g. offline install)
      })
  );
});

// 2. ACTIVATE: Purge stale caches from older deployments & claim clients immediately
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

// 3. MESSAGE: Handle skipWaiting message from client for seamless updates
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 4. FETCH: Smart Network Egress Mitigation Strategies
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

  // B) CACHE-FIRST: Content-addressed static assets (JS, CSS, Audio, Fonts, Images)
  const isImmutableAsset =
    url.pathname.startsWith("/assets/") ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "fonts.googleapis.com" ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".ttf") ||
    url.pathname.endsWith(".ogg") ||
    url.pathname.endsWith(".mp3") ||
    url.pathname.endsWith(".wav") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp");

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

  // C) STALE-WHILE-REVALIDATE: Game posters, icons, storage assets & manifests
  const isPosterOrStorage =
    url.pathname.startsWith("/storage/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.svg";

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

  // D) NETWORK-FIRST with CACHE FALLBACK: HTML navigation, config, leaderboard
  if (
    request.mode === "navigate" ||
    url.pathname.startsWith("/api/config") ||
    url.pathname.startsWith("/api/leaderboard")
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_FALLBACK))
        )
    );
  }
});
