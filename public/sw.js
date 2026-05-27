// ThoughtStack Service Worker
const VERSION  = "thoughtstack-v8";
const CACHE    = VERSION;

// Pages to pre-cache on install so they work offline immediately
const PRECACHE = [
  "/", "/tasks", "/journal", "/calendar",
  "/profile", "/settings", "/offline",
  "/icon-192", "/icon", "/manifest.json",
];

// Scheduled reminders (in-memory — survive SW lifecycle for active sessions)
const reminders = new Map();

// ── Install — pre-cache shell ──────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate — clear old caches ───────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ includeUncontrolled: true, type: "window" })
          .then((clients) =>
            clients.forEach((c) => c.postMessage({ type: "SW_UPDATED", version: VERSION }))
          )
      )
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle GET, same-origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // ── Next.js static chunks — cache-first (content-hashed, safe forever)
  if (url.pathname.startsWith("/_next/static/")) {
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

  // ── Auth session — network-first, cache fallback (enables offline auth check)
  if (url.pathname === "/api/auth/session") {
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
          // Return cached session or empty session object so app doesn't crash
          return cached ?? new Response(JSON.stringify(null), {
            headers: { "Content-Type": "application/json" },
          });
        })
    );
    return;
  }

  // ── Other API routes — network only (no offline fallback needed)
  if (url.pathname.startsWith("/api/")) return;

  // ── Static assets (icons, manifest, fonts)
  if (
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname === "/manifest.json"
  ) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request).catch(() => null);
        if (fresh?.ok) cache.put(request, fresh.clone());
        return fresh ?? new Response("Not found", { status: 404 });
      })
    );
    return;
  }

  // ── App pages — network-first, fall back to cache, then offline page
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
        if (cached) return cached;
        // Try to serve the root page (app shell) for navigation requests
        const root = await caches.match("/");
        if (root) return root;
        return caches.match("/offline");
      })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: "ThoughtStack", body: e.data.text() }; }

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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
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
