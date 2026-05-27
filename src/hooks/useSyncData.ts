"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/store/useAppStore";
import { useOnlineStatus } from "./useOnlineStatus";
import { Task, JournalEntry, CalendarEvent } from "@/types";

type SyncRow<T> = { id: string; data: T; updated_at: string };

function newer<T extends { updatedAt?: string; createdAt?: string }>(a: T, remoteUpdatedAt: string): boolean {
  const localTs = a.updatedAt ?? a.createdAt ?? "0";
  return remoteUpdatedAt > localTs;
}

async function pushAll(tasks: Task[], journals: JournalEntry[], events: CalendarEvent[]) {
  const toRow = <T extends { id: string; updatedAt?: string; createdAt?: string }>(item: T) => ({
    id: item.id,
    data: item,
    updated_at: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
  });

  await Promise.all([
    tasks.length    && fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "tasks",    items: tasks.map(toRow)    }) }),
    journals.length && fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "journals", items: journals.map(toRow) }) }),
    events.length   && fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "events",   items: events.map(toRow)   }) }),
  ].filter(Boolean));
}

export function useSyncData() {
  const { data: session }     = useSession();
  const isOnline              = useOnlineStatus();
  const { tasks, journals, events, addTask, updateTask, addJournal, updateJournal, addEvent, updateEvent } = useAppStore();
  const hasPulled             = useRef(false);

  // Pull on first mount when online + authenticated
  useEffect(() => {
    if (!session?.user || !isOnline || hasPulled.current) return;
    hasPulled.current = true;

    (async () => {
      try {
        const res = await fetch("/api/sync");
        if (!res.ok) return;
        const remote = await res.json() as {
          tasks:    SyncRow<Task>[];
          journals: SyncRow<JournalEntry>[];
          events:   SyncRow<CalendarEvent>[];
        };

        // Strip id from a row.data so it can be passed to add*()
        const stripId = <T extends { id?: string }>(d: T) => {
          const r: Partial<T> = { ...d }; delete r.id; return r as Omit<T, "id">;
        };

        // Merge tasks
        const localTaskIds = new Set(tasks.map((t) => t.id));
        for (const row of remote.tasks) {
          if (!localTaskIds.has(row.id)) addTask(stripId(row.data) as Omit<Task, "id" | "createdAt" | "updatedAt">);
          else { const local = tasks.find((t) => t.id === row.id)!; if (newer(local, row.updated_at)) updateTask(row.id, row.data); }
        }

        // Merge journals
        const localJIds = new Set(journals.map((j) => j.id));
        for (const row of remote.journals) {
          if (!localJIds.has(row.id)) addJournal(stripId(row.data) as Omit<JournalEntry, "id" | "createdAt" | "updatedAt">);
          else { const local = journals.find((j) => j.id === row.id)!; if (newer(local, row.updated_at)) updateJournal(row.id, row.data); }
        }

        // Merge events
        const localEIds = new Set(events.map((e) => e.id));
        for (const row of remote.events) {
          if (!localEIds.has(row.id)) addEvent(stripId(row.data) as Omit<CalendarEvent, "id" | "createdAt">);
          else { const local = events.find((e) => e.id === row.id)!; if (newer(local, row.updated_at)) updateEvent(row.id, row.data); }
        }

      } catch (err) {
        console.warn("[sync] Pull failed:", err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isOnline]);

  // Push periodically (every 3 min) + on window focus
  useEffect(() => {
    if (!session?.user || !isOnline) return;

    const push = () => pushAll(tasks, journals, events).catch(() => {});
    const interval = setInterval(push, 3 * 60 * 1000);
    window.addEventListener("focus", push);
    push(); // immediate push on mount

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", push);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isOnline, tasks.length, journals.length, events.length]);
}
