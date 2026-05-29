"use client";

import { useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/hooks/useToast";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
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

    // Request OS permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Notification permission denied");
      return false;
    }

    // Wait for SW to be ready
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.ready;
    } catch {
      toast.error("Service worker not ready — try refreshing the page");
      return false;
    }

    // Try Web Push (requires VAPID key + server support)
    const vapidKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
    let pushEnabled = false;

    if (vapidKey) {
      try {
        // Check if already subscribed
        const existing = await reg.pushManager.getSubscription();
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const subJson = JSON.stringify(sub);
        setPushSubscription(subJson);

        // Register with server (best-effort)
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        }).catch(() => {/* silent — local storage is the source of truth */});

        pushEnabled = true;
      } catch (err) {
        // Push subscribe can fail in incognito, non-HTTPS, or bad VAPID key.
        // We fall through to local-only mode.
        console.warn("[Push] Web push subscribe failed, using local reminders:", err);
      }
    } else {
      console.warn("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — using local reminders only");
    }

    // Always mark notifications as enabled (SW local reminders work regardless)
    setNotificationsEnabled(true);

    if (pushEnabled) {
      toast.success("Notifications enabled! You'll receive push reminders.");
    } else {
      toast.success("Notifications enabled! Reminders will show while the app is open.");
    }

    return true;
  }, [setPushSubscription, setNotificationsEnabled]);

  const disableNotifications = useCallback(async () => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
    } catch {
      // ignore
    }
    setPushSubscription(null);
    setNotificationsEnabled(false);
    toast.info("Notifications disabled");
  }, [setPushSubscription, setNotificationsEnabled]);

  const sendTestNotification = useCallback(async () => {
    // Local notification (works without server round-trip)
    if (Notification.permission === "granted") {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("ThoughtStack 🧠", {
          body: "Notifications are working! You'll see task reminders here.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        });
        toast.success("Test notification sent!");
        return;
      }
    }

    // Fallback: server-sent push
    if (!pushSubscription) {
      toast.error("Enable notifications first");
      return;
    }
    try {
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: JSON.parse(pushSubscription),
          title: "ThoughtStack 🧠",
          body: "Notifications are working! You'll get task reminders here.",
          url: "/",
        }),
      });
      toast.success("Test notification sent!");
    } catch {
      toast.error("Failed to send test notification");
    }
  }, [pushSubscription]);

  const scheduleReminder = useCallback(
    async (taskId: string, taskTitle: string, dueDate: string, dueTime?: string) => {
      if (!notificationsEnabled) return;

      const timeStr  = dueTime ?? "09:00";
      const dueAt    = new Date(`${dueDate}T${timeStr}`).getTime();
      const delay    = dueAt - Date.now();
      if (delay <= 0) return;

      // Post to SW for local setTimeout-based alarm (works while app is open/in bg)
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.active?.postMessage({
            type: "SCHEDULE_REMINDER",
            payload: {
              id:    taskId,
              title: `⏰ ${taskTitle}`,
              body:  "Your task is due now!",
              dueAt,
              url:   "/tasks",
            },
          });
        } catch {
          // ignore
        }
      }
    },
    [notificationsEnabled]
  );

  const cancelReminder = useCallback(async (taskId: string) => {
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
          type: "CANCEL_REMINDER",
          payload: { id: taskId },
        });
      } catch {
        // ignore
      }
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
