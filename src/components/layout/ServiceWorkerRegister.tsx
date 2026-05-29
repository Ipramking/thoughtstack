"use client";

import { useEffect } from "react";
import { toast } from "@/hooks/useToast";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Capture BEFORE registration — true means a SW is already controlling
    // this page, so any future controllerchange is a real update, not first install.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // First install: no previous controller → SW just claimed the page for
      // the first time. Do NOT reload — there's nothing to update.
      if (!hadController) return;

      // Genuine update: previous SW was replaced by new one.
      // Reload exactly once.
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
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version ready — skip waiting so controllerchange fires
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
