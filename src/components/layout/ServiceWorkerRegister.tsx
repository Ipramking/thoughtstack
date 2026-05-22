"use client";

import { useEffect } from "react";
import { toast } from "@/hooks/useToast";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    // When the active SW changes (new version took control), reload once
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // Listen for the SW_UPDATED message sent from sw.js activate
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SW_UPDATED") {
        // The SW already called skipWaiting + claimed clients.
        // controllerchange will fire and trigger the reload above.
        // This message is just for logging/telemetry.
        console.info("[SW] Updated to", event.data.version);
      }
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
            // New SW installed and waiting — it will activate via skipWaiting
            // which triggers controllerchange → reload handled above
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // There IS a previous SW → this is a real update
              toast.info("App updated — refreshing…");
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
