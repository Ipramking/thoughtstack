"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * useReminderScheduler
 *
 * Re-arms upcoming task reminders periodically. Guards against:
 *   - Browsers terminating idle Service Workers (SW setTimeout state is lost)
 *   - User refreshing the page
 *
 * EMERGENCY-MODE refactor:
 *   - Subscribes only to tasks.length (not the whole tasks array) so this
 *     hook doesn't re-run on every keystroke / sidebar toggle / sync event.
 *   - Reads the current tasks via getState() inside the timer, not via deps.
 *   - Runs every 15 min instead of 5 — reminders fire on time anyway because
 *     the server-side cron handles delivery; this is just a backup.
 *   - Hard cap at 50 reminders scheduled per scan to avoid postMessage flood.
 */
export function useReminderScheduler() {
  const taskCount            = useAppStore((s) => s.tasks.length);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const seenIds              = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const ONE_DAY = 24 * 60 * 60 * 1000;
    const MAX_PER_SCAN = 50;

    async function scheduleAll() {
      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.ready;
      } catch {
        return;
      }

      const now   = Date.now();
      const tasks = useAppStore.getState().tasks;
      let scheduled = 0;

      for (const task of tasks) {
        if (scheduled >= MAX_PER_SCAN) break;
        if (!task.reminder)              continue;
        if (task.status === "done")      continue;
        if (!task.dueDate)               continue;
        if (seenIds.current.has(task.id)) continue;

        const time  = task.dueTime ?? "09:00";
        const dueAt = new Date(`${task.dueDate}T${time}`).getTime();
        if (Number.isNaN(dueAt))       continue;
        if (dueAt <= now)              continue;
        if (dueAt > now + ONE_DAY)     continue;

        seenIds.current.add(task.id);
        scheduled++;

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

    // Initial scan after 10 s grace period
    const initial = setTimeout(scheduleAll, 10_000);
    // Full re-scan every 15 minutes (reset seen-set so SW restarts are covered)
    const interval = setInterval(() => {
      seenIds.current = new Set();
      scheduleAll();
    }, 15 * 60 * 1000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [taskCount, notificationsEnabled]);
}
