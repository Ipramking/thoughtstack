// ThoughtStack Service Worker — v10
// Strategy: never cache HTML (always fresh), cache-first for hashed static
// assets, network-first for auth session.  This prevents the "stale HTML
// referencing dead chunk hash" problem that breaks every deploy.

const VERSION = "thoughtstack-v10";
const CACHE   = VERSION;

// Static-only precache — no HTML, no API
const PRECACHE = [
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

// Scheduled reminders
const reminders = new Map();

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

  // Bail on anything that isn't a normal GET (POST/PUT, chrome-extension, etc.)
  if (request.method !== "GET") return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // Only handle http(s) requests on our own origin
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
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

  // ── 2. Auth session — network-first, cache fallback (offline auth bypass) ────
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
          return cached ?? new Response("null", { headers: { "Content-Type": "application/json" } });
        })
    );
    return;
  }

  // ── 3. Other API routes — network only (skip SW entirely) ────────────────────
  if (url.pathname.startsWith("/api/")) return;

  // ── 4. Static icons / manifest — stale-while-revalidate ──────────────────────
  if (
    url.pathname.endsWith(".png")  ||
    url.pathname.endsWith(".jpg")  ||
    url.pathname.endsWith(".svg")  ||
    url.pathname.endsWith(".ico")  ||
    url.pathname.endsWith(".webp") ||
    url.pathname === "/manifest.json"
  ) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
          .catch(() => cached ?? new Response("Not found", { status: 404 }));
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── 5. HTML pages — NETWORK ONLY, fallback to /offline when truly offline ────
  // We do NOT cache HTML — that's what caused stale-chunk 404s after deploys.
  // The app shell loads fresh every navigation, so chunk hashes always match.
  if (request.mode === "navigate" || request.destination === "document") {
    e.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline");
        return offline ?? new Response("You are offline", { status: 503 });
      })
    );
    return;
  }

  // ── 6. Everything else (fonts, etc) — try network, no cache write ────────────
  e.respondWith(fetch(request).catch(() => new Response("", { status: 504 })));
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
