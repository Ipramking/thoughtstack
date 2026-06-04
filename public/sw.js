// ThoughtStack Service Worker — v15
//
// KEY FIXES:
// 1. Vercel/Next.js sends "Cache-Control: no-store" on SSR pages. Chrome's
//    Cache Storage API refuses to store no-store responses (throws TypeError).
//    cacheResponse() strips no-store before calling cache.put().
// 2. chrome-extension:// URLs are bailed out before ANY URL parsing
//    so they never reach cache.put() at all.
// 3. PRECACHE_PAGES removed — fetching auth-gated routes at install has no
//    session cookie, follows redirect to /auth, would cache the wrong page.
// 4. Version bumped to v14 so browsers that cached a broken older build
//    immediately detect the new file and re-install the worker.

const VERSION = "thoughtstack-v16";
const CACHE   = VERSION;

// Only truly static assets that have no auth requirement.
// Authenticated routes are warmed by the client after login (see prefetchAppRoutes
// in ServiceWorkerRegister.tsx) — they can't be pre-cached at SW install time
// because there's no session cookie yet.
const PRECACHE = [
  "/offline",
  "/auth",                // public auth page — cache so logged-out offline still shows it
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

const reminders = new Map();

// ── Helper: cache a response, stripping no-store if present ──────────────────
async function cacheResponse(cache, request, response) {
  if (!response || !response.ok) return;

  const cc = response.headers.get("cache-control") ?? "";

  let toCache;
  if (cc.includes("no-store")) {
    // Chrome refuses to store no-store responses in Cache Storage (throws TypeError).
    // Create a minimal copy with body + content-type so offline rendering works.
    try {
      const body = await response.clone().blob();
      toCache = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "content-type": response.headers.get("content-type") ?? "text/html; charset=utf-8",
          "x-sw-cached-at": new Date().toISOString(),
        },
      });
    } catch {
      return; // can't read body — skip
    }
  } else {
    toCache = response.clone();
  }

  await cache.put(request, toCache).catch(() => {/* silent */});
}

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate — wipe ALL old caches ─────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients
          .matchAll({ includeUncontrolled: true, type: "window" })
          .then((clients) =>
            clients.forEach((c) =>
              c.postMessage({ type: "SW_UPDATED", version: VERSION })
            )
          )
      )
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;

  // Only intercept GET
  if (request.method !== "GET") return;

  // Bail on non-HTTP schemes before URL parsing (avoids chrome-extension errors)
  if (!request.url.startsWith("http://") && !request.url.startsWith("https://")) return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // ── 1. Next.js static chunks — cache-first (immutable hashed filenames) ──────
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          await cacheResponse(cache, request, fresh);
          return fresh;
        } catch {
          return new Response("Network error", { status: 503 });
        }
      })
    );
    return;
  }

  // ── 2. Auth session — network-first, cache fallback ───────────────────────────
  if (url.pathname === "/api/auth/session") {
    e.respondWith(
      fetch(request)
        .then(async (res) => {
          if (res.ok) {
            const cache = await caches.open(CACHE);
            await cacheResponse(cache, request, res);
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return (
            cached ??
            new Response("null", { headers: { "Content-Type": "application/json" } })
          );
        })
    );
    return;
  }

  // ── 3. Other API routes — network only ───────────────────────────────────────
  if (url.pathname.startsWith("/api/")) return;

  // ── 4. Static assets — stale-while-revalidate ────────────────────────────────
  if (
    url.pathname.endsWith(".png")  ||
    url.pathname.endsWith(".jpg")  ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg")  ||
    url.pathname.endsWith(".ico")  ||
    url.pathname.endsWith(".webp") ||
    url.pathname === "/manifest.json"
  ) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then(async (res) => {
          await cacheResponse(cache, request, res);
          return res;
        }).catch(() => cached ?? new Response("Not found", { status: 404 }));
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── 5. HTML / navigation — network-first, serve cached copy offline ────────────
  //
  // Online:  fetch fresh → strip no-store → store in cache → return to browser
  // Offline: serve cached copy of this exact URL
  //          → fall back to cached "/" (app shell; Next.js router handles routing)
  //          → last resort: /offline page
  //
  // This is the key offline-capable strategy. Pages get cached as the user browses
  // while online. Authentication-gated pages only cache AFTER the user has logged in.
  if (request.mode === "navigate" || request.destination === "document") {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          // Cache regardless of Cache-Control: no-store (our helper strips it)
          await cacheResponse(cache, request, fresh);
          return fresh;
        } catch {
          // ── Offline fallback chain ──────────────────────────────────────────
          const cached = await cache.match(request);
          if (cached) return cached;

          // Try the root as a generic app shell (client-side router takes over)
          const shell = await cache.match(new Request("/"));
          if (shell) return shell;

          // True last resort
          const offlinePage = await caches.match("/offline");
          return (
            offlinePage ??
            new Response("You are offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })
    );
    return;
  }

  // ── 6. Everything else — network only ────────────────────────────────────────
  e.respondWith(fetch(request).catch(() => new Response("", { status: 504 })));
});

// ── Background Sync ───────────────────────────────────────────────────────────
// Browsers fire this event when the network returns after an offline period,
// even if no tab is open. We use it to nudge any open clients to flush queued
// data. If no client is open the sync is a no-op — the next tab open does it.
self.addEventListener("sync", (e) => {
  if (e.tag !== "ts-sync-data") return;
  e.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" })
      .then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "BACKGROUND_SYNC" }));
      })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
// Server (cron) push lands here. Notification `tag` matches task id so this
// REPLACES any local SW-setTimeout notification for the same task → user sees
// exactly one notification, never two.
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: "ThoughtStack", body: e.data.text() }; }
  const { title = "ThoughtStack 🧠", body = "", url = "/", tag } = data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    "/icon-192.png",
      badge:   "/icon-192.png",
      vibrate: [100, 50, 100],
      tag:     tag || undefined,   // dedupes with local-scheduled reminder
      renotify: !!tag,             // re-alert even when replacing a stale tag
      data:    { url },
      actions: [
        { action: "open",    title: "Open"    },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;

  const target = e.notification.data?.url ?? "/";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) { existing.focus(); existing.navigate(target); }
        else self.clients.openWindow(target);
      })
  );
});

// ── Messages from app ─────────────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  const { type, payload } = e.data ?? {};

  if (type === "SKIP_WAITING") { self.skipWaiting(); return; }

  if (type === "SCHEDULE_REMINDER") {
    const { id, title, body, dueAt, url } = payload;
    const delay = dueAt - Date.now();
    if (delay <= 0) return;
    if (reminders.has(id)) clearTimeout(reminders.get(id).timerId);

    const timerId = setTimeout(() => {
      self.registration.showNotification(title ?? "Reminder", {
        body:    body ?? "Your task is due now!",
        icon:    "/icon-192.png",
        badge:   "/icon-192.png",
        vibrate: [200, 100, 200],
        tag:     id,         // shared with server push so only one notification shows
        renotify: true,
        data:    { url: url ?? "/tasks" },
        actions: [{ action: "open", title: "View task" }],
      });
      reminders.delete(id);
    }, delay);

    reminders.set(id, { title, timerId });
    return;
  }

  if (type === "CANCEL_REMINDER") {
    const { id } = payload ?? {};
    if (reminders.has(id)) { clearTimeout(reminders.get(id).timerId); reminders.delete(id); }
  }
});
