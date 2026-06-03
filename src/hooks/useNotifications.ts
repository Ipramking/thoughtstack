"use client";

import { useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/hooks/useToast";

// Returns a fresh ArrayBuffer (not ArrayBufferLike) so the result satisfies
// PushManager.subscribe's `applicationServerKey: BufferSource` constraint
// under Next.js 15's stricter TS lib types.
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function useNotifications() {
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    pushSubscription,
    setPushSubscription,
  } = useAppStore();

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported in this browser");
      return false;
    }
    if (!("serviceWorker" in navigator)) {
      toast.error("Service worker not supported");
      return false;
    }

    // iOS-specific: web push requires iOS 16.4+ AND PWA install
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIOS && !isStandalone) {
      toast.error("On iOS, install ThoughtStack to your home screen first, then enable notifications from inside the installed app.");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error(
        permission === "denied"
          ? "Notifications blocked — enable them in your browser site settings"
          : "Notification permission was not granted"
      );
      return false;
    }

    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.ready;
    } catch {
      toast.error("Service worker not ready — try refreshing the page");
      return false;
    }

    const vapidKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
    let pushEnabled = false;

    if (vapidKey) {
      try {
        const existing = await reg.pushManager.getSubscription();
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        setPushSubscription(JSON.stringify(sub));

        // Persist on server so the cron can push to this device when closed
        const res = await fetch("/api/push/subscribe", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ subscription: sub }),
        });
        if (!res.ok) {
          console.warn("[Push] Server failed to persist subscription:", await res.text());
        }
        pushEnabled = true;
      } catch (err) {
        console.warn("[Push] Web push subscribe failed:", err);
      }
    } else {
      console.warn("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — local-only mode");
    }

    setNotificationsEnabled(true);
    toast.success(
      pushEnabled
        ? "Notifications enabled! Reminders will fire even when the app is closed."
        : "Notifications enabled (local-only — install as PWA for background delivery)."
    );
    return true;
  }, [setPushSubscription, setNotificationsEnabled]);

  const disableNotifications = useCallback(async () => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Tell server to forget this device first (uses endpoint)
          fetch("/api/push/subscribe", {
            method:  "DELETE",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {/* silent */});
          await sub.unsubscribe();
        }
      }
    } catch {/* ignore */}

    setPushSubscription(null);
    setNotificationsEnabled(false);
    toast.info("Notifications disabled");
  }, [setPushSubscription, setNotificationsEnabled]);

  const sendTestNotification = useCallback(async () => {
    if (Notification.permission !== "granted") {
      toast.error("Enable notifications first");
      return;
    }

    if (pushSubscription) {
      try {
        const res = await fetch("/api/push/send", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            subscription: JSON.parse(pushSubscription),
            title:        "ThoughtStack 🧠",
            body:         "Push delivery is working — you'll get reminders even when the app is closed.",
            url:          "/",
          }),
        });
        if (res.ok) {
          toast.success("Push notification sent — check your notification tray");
          return;
        }
        const data = await res.json().catch(() => ({} as { error?: string }));
        if (res.status === 410 || res.status === 404) {
          setPushSubscription(null);
          toast.error("Push subscription expired — re-enable notifications");
          return;
        }
        toast.error(`Push failed: ${data.error ?? "server error"} — falling back to local`);
      } catch {
        toast.error("Network error sending push — falling back to local");
      }
    }

    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("ThoughtStack 🧠", {
        body: pushSubscription
          ? "Local fallback — push delivery isn't working but local notifications are."
          : "Notifications are working! (Local-only mode — install as PWA for background delivery.)",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      });
      toast.success("Test notification sent!");
    }
  }, [pushSubscription, setPushSubscription]);

  const scheduleReminder = useCallback(
    async (taskId: string, taskTitle: string, dueDate: string, dueTime?: string) => {
      if (!notificationsEnabled) return;

      const timeStr = dueTime ?? "09:00";
      const dueAt   = new Date(`${dueDate}T${timeStr}`).getTime();
      if (Number.isNaN(dueAt) || dueAt <= Date.now()) return;

      // 1. Server-side: cron will push at due_at even if browser is closed.
      //    Best-effort — silent on failure (offline, server down, etc.)
      fetch("/api/reminders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          id:    taskId,
          title: `⏰ ${taskTitle}`,
          body:  "Your task is due now!",
          url:   "/tasks",
          dueAt,
        }),
      }).catch(() => {/* silent */});

      // 2. Local: SW setTimeout fires if app/SW are still alive at due time.
      //    Notification tag = taskId so browser shows only ONE notification
      //    even if both server-push and local-SW fire.
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.active?.postMessage({
            type:    "SCHEDULE_REMINDER",
            payload: {
              id:    taskId,
              title: `⏰ ${taskTitle}`,
              body:  "Your task is due now!",
              dueAt,
              url:   "/tasks",
            },
          });
        } catch {/* ignore */}
      }
    },
    [notificationsEnabled]
  );

  const cancelReminder = useCallback(async (taskId: string) => {
    // 1. Server: stop the cron from firing it
    fetch("/api/reminders", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: taskId }),
    }).catch(() => {/* silent */});

    // 2. Local: cancel the SW setTimeout if it's still pending
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: "CANCEL_REMINDER", payload: { id: taskId } });
      } catch {/* ignore */}
    }
  }, []);

  return {
    notificationsEnabled,
    requestPermission,
    disableNotifications,
    sendTestNotification,
    scheduleReminder,
    cancelReminder,
  };
}
