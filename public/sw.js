// ThoughtStack Service Worker — v12
// Strategy:
//  - HTML pages → network-first + cache; offline = serve cached page or app-shell
//  - /_next/static/ → cache-first (immutable hashed chunks)
//  - /api/auth/session → network-first + cache (offline auth bypass)
//  - other /api/ → network only (never cache)
//  - images / manifest → stale-while-revalidate
//  - chrome-extension / data / blob → bailed out early

const VERSION = "thoughtstack-v12";
const CACHE   = VERSION;

// Pre-cache app shell + offline fallback + static assets
// Wrapped in a nested addAll so a single 404 doesn't break the whole install.
const PRECACHE_SHELL = [
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

// Main app routes — cached so offline navigation works.
// Each fetch is wrapped separately so one failure doesn't kill the rest.
const PRECACHE_PAGES = [
  "/",
  "/tasks",
  "/journal",
  "/calendar",
  "/profile",
  "/settings",
];

// In-memory scheduled reminders (cleared on SW restart, which is acceptable)
const reminders = new Map();

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Critical shell assets — must succeed
      await cache.addAll(PRECACHE_SHELL).catch(() => {});

      // App pages — best-effort (might fail if offline at install time)
      await Promise.allSettled(
        PRECACHE_PAGES.map((url) =>
          cache.add(url).catch(() => {/* ignore individual failures */})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate — wipe ALL old caches ─────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
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

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;

  // Only intercept GET
  if (request.method !== "GET") return;

  // Bail on non-HTTP schemes early — before parsing URL (avoids chrome-extension errors)
  if (
    !request.url.startsWith("http://") &&
    !request.url.startsWith("https://")
  ) return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // ── 1. Next.js static chunks — cache-first (hash-named, immutable) ───────────
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return new Response("Network error", { status: 503 });
        }
      })
    );
    return;
  }

  // ── 2. Auth session — network-first, cache fallback ──────────────────────────
  if (url.pathname === "/api/auth/session") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return (
            cached ??
            new Response("null", {
              headers: { "Content-Type": "application/json" },
            })
          );
        })
    );
    return;
  }

  // ── 3. Other API routes — network only (never cache) ─────────────────────────
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
        const fetchPromise = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached ?? new Response("Not found", { status: 404 }));
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── 5. HTML pages — NETWORK-FIRST with offline cache fallback ────────────────
  //
  // This is the key change from v10/v11. We now:
  //   a) Try the network and cache the fresh response
  //   b) On failure: serve the cached version of this exact URL
  //   c) Fall back to cached "/" (app shell that Next.js router can handle)
  //   d) Last resort: serve /offline
  //
  // This means tasks/journal/etc work offline as long as the user visited them online.
  if (request.mode === "navigate" || request.destination === "document") {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            // Cache this page for offline use
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          // Offline path — check caches in priority order
          const cached = await cache.match(request);
          if (cached) return cached;

          // App-shell fallback: "/" handles all client-side routing
          const shell = await cache.match(new Request("/"));
          if (shell) return shell;

          // Last resort
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

  // ── 6. Everything else (fonts, etc.) — network only ──────────────────────────
  e.respondWith(
    fetch(request).catch(() => new Response("", { status: 504 }))
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data = {};
  try {
    data = e.data.json();
  } catch {
    data = { title: "ThoughtStack", body: e.data.text() };
  }
  const { title = "ThoughtStack 🧠", body = "", url = "/" } = data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    "/icon-192.png",
      badge:   "/icon-192.png",
      vibrate: [100, 50, 100],
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
        const existing = clients.find((c) =>
          c.url.includes(self.location.origin)
        );
        if (existing) {
          existing.focus();
          existing.navigate(target);
        } else {
          self.clients.openWindow(target);
        }
      })
  );
});

// ── Messages from app ─────────────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  const { type, payload } = e.data ?? {};

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

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
    if (reminders.has(id)) {
      clearTimeout(reminders.get(id).timerId);
      reminders.delete(id);
    }
  }
});
