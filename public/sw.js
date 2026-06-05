// ThoughtStack Service Worker — v18
//
// History of fixes (cumulative):
//   - Vercel/Next.js sends "Cache-Control: no-store" on SSR pages. Chrome's
//     Cache Storage API refuses to store no-store responses (throws TypeError).
//     cacheResponse() strips no-store before calling cache.put().
//   - chrome-extension:// URLs are bailed out before any URL parsing.
//   - response.redirected check: never cache a response whose body doesn't
//     match the request URL (prevents the auth-page-cached-as-/ bug).
//   - v18: install handler no longer uses caches.addAll() — it bypasses
//     cacheResponse() and so silently fails on no-store pages. We now fetch
//     each PRECACHE entry through our own helper.

const VERSION = "thoughtstack-v19";
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

// In-memory map of active setTimeout handles. Lost on every SW restart —
// that's fine, because the SOURCE OF TRUTH is the IndexedDB 'reminders' store.
// On every activate, restoreReminders() reads IDB and re-arms timers from scratch.
const reminders = new Map();

// ── IndexedDB-backed reminder store ──────────────────────────────────────────
// Browsers terminate idle Service Workers after ~30 s. setTimeout handles die
// with them, so a reminder scheduled at 9 a.m. for 5 p.m. is gone by lunchtime.
// We persist every SCHEDULE_REMINDER to IndexedDB and restore on activate.
const IDB_NAME    = "ts-sw";
const IDB_STORE   = "reminders";
const IDB_VERSION = 1;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPutReminder(reminder) {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(reminder);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch {/* idb unavailable — best-effort */}
}

async function idbDeleteReminder(id) {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch {/* ignore */}
}

async function idbGetAllReminders() {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

function armReminder(rec) {
  const delay = rec.dueAt - Date.now();
  if (delay <= 0) {
    // Already past due — fire immediately to avoid losing it
    fireReminder(rec);
    return;
  }
  // Clear any prior timer for this id
  if (reminders.has(rec.id)) clearTimeout(reminders.get(rec.id).timerId);
  const timerId = setTimeout(() => fireReminder(rec), delay);
  reminders.set(rec.id, { timerId });
}

function fireReminder(rec) {
  self.registration.showNotification(rec.title || "Reminder", {
    body:    rec.body || "Your task is due now!",
    icon:    "/icon-192.png",
    badge:   "/icon-192.png",
    vibrate: [200, 100, 200],
    tag:     rec.id,
    renotify: true,
    data:    { url: rec.url || "/tasks" },
    actions: [{ action: "open", title: "View task" }],
  });
  reminders.delete(rec.id);
  void idbDeleteReminder(rec.id);
}

async function restoreReminders() {
  const all = await idbGetAllReminders();
  for (const rec of all) armReminder(rec);
}

// ── Helper: cache a response, stripping no-store if present ──────────────────
//
// CRITICAL: response.redirected === true means the original URL got redirected
// (e.g. unauthenticated GET / → 302 → /auth). If we cache that response under
// the original key (request.url), we end up serving the auth page HTML when
// the user later opens "/" offline. That's how PWA installs were getting
// "stuck on the auth page when opened offline".
//
// We refuse to cache:
//   - Failed responses (not 2xx)
//   - Opaque or redirected responses (don't match the request URL semantically)
async function cacheResponse(cache, request, response) {
  if (!response || !response.ok)  return;
  if (response.redirected)        return;
  if (response.type === "opaque") return;

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

// ── Helper: minimal inline HTML so PWA always opens when offline ──────────────
//
// Used as the absolute last fallback when EVERY navigation request fails and
// neither the requested URL nor "/" is cached. Renders a friendly "loading…"
// screen with a "Retry" button. The page also pings the SW every few seconds
// to detect when the SW has a usable cache and reload.
function offlineShellResponse(pathname) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>ThoughtStack</title>
  <link rel="icon" href="/icon-192.png">
  <style>
    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
    html,body { height: 100%; background: #0d0d0d; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
    body { display: flex; align-items: center; justify-content: center; padding: 24px; }
    .wrap { max-width: 360px; text-align: center; }
    .logo { width: 56px; height: 56px; border-radius: 14px; margin: 0 auto 20px;
      background: linear-gradient(180deg, #1a1a1e 0%, #0d0d0d 100%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 32px rgba(124,58,237,0.25); }
    .logo svg { color: #a78bfa; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    p { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.6); margin-bottom: 20px; }
    .btn { display: inline-block; padding: 12px 22px; border: 0; border-radius: 12px;
      background: #fff; color: #0d0d0d; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn:active { transform: scale(0.97); }
    .dots { display: inline-flex; gap: 4px; margin-top: 16px; }
    .dots span { width: 5px; height: 5px; border-radius: 50%; background: #a78bfa;
      animation: pulse 1.4s ease-in-out infinite; }
    .dots span:nth-child(2) { animation-delay: 0.2s; }
    .dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse { 0%,80%,100% { opacity: 0.2; } 40% { opacity: 1; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 4h14M12 4v16"/>
      </svg>
    </div>
    <h1>ThoughtStack</h1>
    <p>You're offline and this page isn't cached yet. Reconnect to load it, or try the home screen.</p>
    <button class="btn" onclick="location.href='/'">Go to home</button>
    <div class="dots"><span></span><span></span><span></span></div>
  </div>
  <script>
    // When network comes back, reload to the route the user originally wanted
    window.addEventListener("online", () => location.replace(${JSON.stringify(pathname)}));
  </script>
</body>
</html>`;
  return new Response(html, {
    status:  200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// ── Install ────────────────────────────────────────────────────────────────────
//
// Replaces caches.addAll() which uses raw cache.put() and silently fails on
// no-store responses (i.e. every Next.js SSR page). We loop manually and run
// each response through cacheResponse() which strips no-store before storing.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE.map(async (path) => {
          try {
            const res = await fetch(path, { credentials: "same-origin" });
            await cacheResponse(cache, new Request(path), res);
          } catch {/* one missing path shouldn't block the rest */}
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate — wipe old caches + restore persisted reminders ─────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      // Restore any reminders that were scheduled in a previous SW lifecycle.
      // Browsers terminate idle SWs every ~30 s; without this, a reminder set
      // in the morning silently disappears by the afternoon.
      .then(() => restoreReminders())
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
          const cached = await caches.match(request, { ignoreVary: true });
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

  // ── 5. HTML / navigation — network-first, robust offline fallback ────────────
  //
  // Online:  fetch fresh → strip no-store + skip-if-redirected → cache → return.
  // Offline: serve cached copy of this exact URL (ignoring query/vary)
  //          → fall back to cached "/" (Next.js client router takes over)
  //          → fall back to cached "/auth"   (so logged-out users still see login)
  //          → fall back to cached "/offline"
  //          → absolute last resort: inline HTML shell that auto-reloads on reconnect.
  //
  // The inline shell guarantees the PWA never opens to a blank white page.
  if (request.mode === "navigate" || request.destination === "document") {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          await cacheResponse(cache, request, fresh);
          return fresh;
        } catch {
          // ── Offline fallback chain ────────────────────────────────────────
          const opts = { ignoreSearch: true, ignoreVary: true };

          const cached = await cache.match(request, opts);
          if (cached) return cached;

          const root = await cache.match(new Request("/"), opts);
          if (root) return root;

          const authShell = await cache.match(new Request("/auth"), opts);
          if (authShell) return authShell;

          const offlinePage = await cache.match(new Request("/offline"), opts);
          if (offlinePage) return offlinePage;

          // Truly nothing cached — show inline rescue shell so PWA opens
          return offlineShellResponse(url.pathname);
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
        // startsWith — not includes — so an unrelated tab whose URL happens
        // to contain our origin substring doesn't get focused by accident.
        const existing = clients.find((c) => c.url.startsWith(self.location.origin));
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
    if (!id || !dueAt) return;
    const rec = { id, title, body, dueAt, url };
    armReminder(rec);
    // Persist so it survives SW termination (the source-of-truth)
    void idbPutReminder(rec);
    return;
  }

  if (type === "CANCEL_REMINDER") {
    const { id } = payload ?? {};
    if (!id) return;
    if (reminders.has(id)) { clearTimeout(reminders.get(id).timerId); reminders.delete(id); }
    void idbDeleteReminder(id);
  }
});
