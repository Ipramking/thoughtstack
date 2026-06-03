"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * useReminderScheduler
 *
 * Reschedules all upcoming task reminders every time the app mounts and
 * every 5 minutes thereafter. This is a defence against:
 *   - Browsers terminating idle Service Workers (kills SW setTimeout)
 *   - User refreshing the page (clears in-memory SW state)
 *   - Tab being closed and reopened
 *
 * For reminders that fall within the next 24 h we forward them to the SW.
 * Reminders further out are skipped — the next scan will catch them.
 *
 * Note: this does NOT solve background delivery when the browser is fully
 * closed. That requires server-side Web Push triggered by a cron job —
 * which needs subscriptions persisted to Supabase (TODO).
 */
export function useReminderScheduler() {
  const tasks = useAppStore((s) => s.tasks);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const ONE_DAY = 24 * 60 * 60 * 1000;

    async function scheduleAll() {
      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.ready;
      } catch {
        return;
      }

      const now = Date.now();

      for (const task of tasks) {
        if (!task.reminder) continue;
        if (task.status === "done") continue;
        if (!task.dueDate) continue;

        const time = task.dueTime ?? "09:00";
        const dueAt = new Date(`${task.dueDate}T${time}`).getTime();
        if (Number.isNaN(dueAt)) continue;
        if (dueAt <= now) continue;            // already passed
        if (dueAt > now + ONE_DAY) continue;   // too far out — next scan handles it

        // Skip ones we already scheduled this session
        if (seenIds.current.has(task.id)) continue;
        seenIds.current.add(task.id);

        reg.active?.postMessage({
          type: "SCHEDULE_REMINDER",
          payload: {
            id:    task.id,
            title: `⏰ ${task.title}`,
            body:  "Your task is due now!",
            dueAt,
            url:   "/tasks",
          },
        });
      }
    }

    // Run immediately + every 5 minutes
    scheduleAll();
    const interval = setInterval(() => {
      // Reset seenIds each scan so re-scheduling works after SW restart
      seenIds.current = new Set();
      scheduleAll();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [tasks, notificationsEnabled]);
}
