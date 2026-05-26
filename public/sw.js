// ThoughtStack Service Worker
const VERSION   = "thoughtstack-v5";
const CACHE     = VERSION;
const PRECACHE  = ["/", "/tasks", "/journal", "/calendar", "/offline"];

// Scheduled reminders (stored in memory — survive SW lifecycle via IndexedDB in prod)
const reminders = new Map(); // id → { title, body, url, timerId }

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ includeUncontrolled: true, type: "window" })
          .then((clients) => clients.forEach((c) => c.postMessage({ type: "SW_UPDATED", version: VERSION })))
      )
  );
});

// ── Fetch — network-first for pages, cache-first for Next.js chunks ───────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/")) {
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
        return cached ?? caches.match("/offline");
      })
  );
});

// ── Push — show notification when server pushes ───────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: "ThoughtStack", body: e.data.text() }; }

  const { title = "ThoughtStack 🧠", body = "", url = "/" } = data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    "/icon",
      badge:   "/icon",
      vibrate: [100, 50, 100],
      data:    { url },
      actions: [
        { action: "open",    title: "Open app" },
        { action: "dismiss", title: "Dismiss"  },
      ],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;

  const targetUrl = e.notification.data?.url ?? "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
      } else {
        self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Messages from the main thread ─────────────────────────────────────────────
self.addEventListener("message", (e) => {
  const { type, payload } = e.data ?? {};

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  // Schedule a local reminder alarm
  if (type === "SCHEDULE_REMINDER") {
    const { id, title, body, dueAt, url } = payload;
    const delay = dueAt - Date.now();
    if (delay <= 0) return;

    // Clear any existing timer for this reminder
    if (reminders.has(id)) {
      clearTimeout(reminders.get(id).timerId);
    }

    const timerId = setTimeout(() => {
      self.registration.showNotification(title ?? "Reminder", {
        body:    body ?? "Your task is due now!",
        icon:    "/icon",
        badge:   "/icon",
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
