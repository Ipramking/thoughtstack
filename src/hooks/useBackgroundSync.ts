"use client";

import { useEffect } from "react";

/**
 * Background Sync API registration.
 *
 * Lets the browser fire a sync event when the network returns, even after the
 * tab is closed. The SW receives a 'sync' event and can flush any queued data.
 *
 * Not all browsers support this (Safari still doesn't). We feature-detect and
 * silently no-op when unavailable. The periodic in-tab sync (useSyncData)
 * continues to work as the fallback.
 */
export function useBackgroundSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Type narrowing for SyncManager (not in default lib.dom yet)
    type SyncRegistration = ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };

    const tryRegister = async () => {
      try {
        const reg = (await navigator.serviceWorker.ready) as SyncRegistration;
        if (!reg.sync) return; // browser doesn't support Background Sync
        await reg.sync.register("ts-sync-data");
      } catch {/* permission denied or unsupported — silent */}
    };

    // Register on mount + every time the tab regains focus
    void tryRegister();
    window.addEventListener("focus", tryRegister);
    window.addEventListener("online", tryRegister);

    return () => {
      window.removeEventListener("focus", tryRegister);
      window.removeEventListener("online", tryRegister);
    };
  }, []);
}
