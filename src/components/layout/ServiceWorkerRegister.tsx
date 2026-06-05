"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "@/hooks/useToast";

// Routes to make available offline. Fetched one-at-a-time during browser idle
// time so they don't compete with the active page's rendering.
const OFFLINE_ROUTES = ["/", "/tasks", "/journal", "/calendar", "/profile", "/settings", "/account"];

/** Has this route been cached by any service worker cache? */
async function isCached(path: string): Promise<boolean> {
  if (!("caches" in window)) return true; // can't check — assume yes
  const keys = await caches.keys();
  for (const k of keys) {
    const cache = await caches.open(k);
    // ignoreVary + ignoreSearch so cookie/query variance doesn't trick us
    // into re-fetching pages that are already cached.
    const match = await cache.match(new Request(path), { ignoreVary: true, ignoreSearch: true });
    if (match) return true;
  }
  return false;
}

/**
 * Idle-time route prefetcher.
 *
 * Strategy:
 *   - Wait until the browser reports it's idle (or 10 s after login).
 *   - Fetch ONE route at a time, with a 2 s pause between each.
 *   - Stop immediately on tab blur or going offline.
 *   - Skip routes that are already cached.
 *
 * The SW's existing fetch handler will cache each response via cacheResponse(),
 * which strips no-store before storing — same path as a normal navigation.
 *
 * This was the old `warmOfflineCache` rewritten in slow-motion. The previous
 * version fetched all 6 routes in parallel 3 s after login, which combined
 * with the sync push loop, was enough to thrash mobile devices.
 */
function prefetchAppRoutes(): () => void {
  let cancelled = false;

  async function run() {
    // Bail early if anything important changes
    const shouldStop = () =>
      cancelled ||
      document.visibilityState === "hidden" ||
      !navigator.onLine;

    for (const path of OFFLINE_ROUTES) {
      if (shouldStop()) return;
      if (await isCached(path)) continue;

      // Yield to idle, then fetch
      await new Promise<void>((res) => {
        const cb = () => res();
        if ("requestIdleCallback" in window) {
          (window as Window & typeof globalThis).requestIdleCallback(cb, { timeout: 4000 });
        } else {
          setTimeout(cb, 800);
        }
      });
      if (shouldStop()) return;

      try {
        // Triggers a fetch event in our SW, which caches the response
        await fetch(path, { credentials: "include", headers: { Accept: "text/html" } });
      } catch {/* ignore — try the next one */}

      // 2 s breathing room before the next fetch
      await new Promise<void>((res) => setTimeout(res, 2000));
    }
  }

  // Wait 10 s after login before starting (page should be settled)
  const startTimer = setTimeout(run, 10_000);

  return () => {
    cancelled = true;
    clearTimeout(startTimer);
  };
}

export function ServiceWorkerRegister() {
  const { data: session } = useSession();

  // ── Register the SW ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Update-check on tab focus only (no background polling loop)
        const onFocus = () => reg.update().catch(() => {});
        window.addEventListener("focus", onFocus);

        // Register background sync so queued writes flush when network returns.
        // SyncManager is only available in Chrome/Edge — feature-detect first.
        const swReg = reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
        if (swReg.sync) {
          swReg.sync.register("ts-sync-data").catch(() => {/* not supported */});
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
              toast.info("App updated — reloading…");
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  }, []);

  // ── Idle-time route prefetcher ──────────────────────────────────────────────
  // Only runs when authenticated and online. Stops immediately if the tab
  // goes hidden or the network drops. Cancelled on session change.
  useEffect(() => {
    if (!session?.user) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const cancel = prefetchAppRoutes();
    return cancel;
  }, [session]);

  return null;
}
