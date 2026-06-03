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

    // iOS-specific: web push only works on iOS 16.4+ AND only when the app
    // has been installed to the home screen as a PWA.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIOS && !isStandalone) {
      toast.error("On iOS, install ThoughtStack to your home screen first, then enable notifications from inside the installed app.");
      return false;
    }

    // Request OS permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error(
        permission === "denied"
          ? "Notifications blocked — enable them in your browser site settings"
          : "Notification permission was not granted"
      );
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
    if (Notification.permission !== "granted") {
      toast.error("Enable notifications first");
      return;
    }

    // If we have a push subscription, test the FULL server → push → SW pipeline.
    // This is what really matters — local SW notifications work always but
    // server push is what delivers reminders when the app is closed.
    if (pushSubscription) {
      try {
        const res = await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: JSON.parse(pushSubscription),
            title: "ThoughtStack 🧠",
            body: "Push delivery is working — you'll get reminders even when the app is closed.",
            url: "/",
          }),
        });
        if (res.ok) {
          toast.success("Push notification sent — check your notification tray");
          return;
        }
        const data = await res.json().catch(() => ({} as { error?: string }));
        if (res.status === 410 || res.status === 404) {
          // Subscription is gone — clear it and tell the user to re-enable
          setPushSubscription(null);
          toast.error("Push subscription expired — re-enable notifications");
          return;
        }
        console.warn("[Push] Send failed:", data);
        toast.error(`Push failed: ${data.error ?? "server error"} — falling back to local`);
      } catch {
        toast.error("Network error sending push — falling back to local");
      }
    }

    // Local fallback (SW.showNotification directly, no server round-trip)
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
