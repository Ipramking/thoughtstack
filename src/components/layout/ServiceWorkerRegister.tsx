"use client";

import { useEffect } from "react";
import { toast } from "@/hooks/useToast";

// ── EMERGENCY-MODE service worker registration ────────────────────────────────
//
// The previous version polled SW updates every 60 s and pre-fetched 6 pages
// in the background 3 s after login. Combined with the sync push loop, on
// devices with thousands of duplicated tasks (legacy bug) this was enough
// to thrash the main thread and crash mobile browsers.
//
// This stripped-down version:
//   - Registers the SW (one-time)
//   - Only checks for updates on tab focus (not every 60 s)
//   - Does NOT pre-warm any caches — pages cache naturally as user browses
//   - Skips waiting on new SW, then reloads exactly once on controllerchange

export function ServiceWorkerRegister() {
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
        // Update-check on tab focus only. No background polling loop.
        const onFocus = () => reg.update().catch(() => {});
        window.addEventListener("focus", onFocus);

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

  return null;
}
