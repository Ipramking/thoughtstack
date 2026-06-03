"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "@/hooks/useToast";

// Pages to warm the offline cache with after the user logs in.
// These are fetched in the background so offline navigation works.
const WARM_PATHS = ["/", "/tasks", "/journal", "/calendar", "/profile", "/settings"];

async function warmOfflineCache() {
  if (!("caches" in window)) return;
  // Find the active cache (starts with "thoughtstack-")
  const keys = await caches.keys();
  const swCache = keys.find((k) => k.startsWith("thoughtstack-"));
  if (!swCache) return;

  const cache = await caches.open(swCache);

  await Promise.allSettled(
    WARM_PATHS.map(async (path) => {
      try {
        // Use {credentials: "include"} so auth cookies are sent
        const res = await fetch(path, {
          credentials: "include",
          headers: { Accept: "text/html" },
        });
        if (!res.ok) return;

        // Strip no-store before caching (same as the SW helper does)
        const cc = res.headers.get("cache-control") ?? "";
        let toCache: Response;
        if (cc.includes("no-store")) {
          const body = await res.blob();
          toCache = new Response(body, {
            status: res.status,
            headers: {
              "content-type": res.headers.get("content-type") ?? "text/html; charset=utf-8",
              "x-sw-cached-at": new Date().toISOString(),
            },
          });
        } else {
          toCache = res.clone();
        }

        await cache.put(path, toCache).catch(() => {});
      } catch {
        // Silent — network failure or already cached
      }
    })
  );
}

export function ServiceWorkerRegister() {
  const { data: session } = useSession();

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
        // Poll for updates every 60 s (catches long-lived tabs)
        setInterval(() => reg.update(), 60_000);

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

  // Warm the offline cache when the user is authenticated.
  // Runs once per session (or after a SW cache wipe on new deploy).
  useEffect(() => {
    if (!session?.user) return;
    // Small delay so the page itself finishes loading first
    const t = setTimeout(() => warmOfflineCache(), 3000);
    return () => clearTimeout(t);
  }, [session]);

  return null;
}
