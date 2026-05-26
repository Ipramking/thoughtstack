"use client";

import { useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "@/hooks/useToast";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function useNotifications() {
  const { notificationsEnabled, setNotificationsEnabled, pushSubscription, setPushSubscription } = useAppStore();

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported on this browser");
      return false;
    }
    if (!("serviceWorker" in navigator)) {
      toast.error("Service worker not supported");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Notification permission denied");
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });

      const subJson = JSON.stringify(sub);
      setPushSubscription(subJson);
      setNotificationsEnabled(true);

      // Register with server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });

      toast.success("Notifications enabled! You'll get reminders for tasks.");
      return true;
    } catch (err) {
      console.error("[Push] Subscribe failed:", err);
      toast.error("Could not enable push notifications");
      return false;
    }
  }, [setPushSubscription, setNotificationsEnabled]);

  const sendTestNotification = useCallback(async () => {
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

  const scheduleReminder = useCallback(async (taskTitle: string, dueDate: string, dueTime: string) => {
    if (!pushSubscription) return;
    const dueAt = new Date(`${dueDate}T${dueTime}`).getTime();
    const delay = dueAt - Date.now();
    if (delay <= 0) return;

    // Register with SW for local alarm (works when app is open / in background)
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({
        type: "SCHEDULE_REMINDER",
        payload: { title: taskTitle, dueAt, url: "/tasks" },
      });
    }
  }, [pushSubscription]);

  return { notificationsEnabled, requestPermission, sendTestNotification, scheduleReminder };
}
