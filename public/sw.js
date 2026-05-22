// ThoughtStack Service Worker
// Bump this version string on every deploy to bust caches and trigger reload
const VERSION = "thoughtstack-v3";
const CACHE   = VERSION;

const PRECACHE = ["/", "/offline"];

// ── Install: pre-cache shell pages ───────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => {})) // swallow 404s
      .then(() => self.skipWaiting())                  // activate immediately
  );
});

// ── Activate: delete stale caches, claim clients, signal reload ───────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() =>
        // Tell every open tab: "a new version just activated — reload when ready"
        self.clients.matchAll({ includeUncontrolled: true, type: "window" })
          .then((clients) =>
            clients.forEach((client) =>
              client.postMessage({ type: "SW_UPDATED", version: VERSION })
            )
          )
      )
  );
});

// ── Fetch: network-first for navigation, stale-while-revalidate for assets ───
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Always bypass: API routes, non-GET, cross-origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/")) {
    // Next.js static chunks — cache aggressively (they're content-hashed)
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // Navigation / pages — network-first, fall back to cache then offline page
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached ?? caches.match("/");
      })
  );
});

// ── Listen for manual SKIP_WAITING from the client ───────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
