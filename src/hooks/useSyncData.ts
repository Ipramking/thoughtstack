"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/store/useAppStore";
import { useOnlineStatus } from "./useOnlineStatus";
import { Task, JournalEntry, CalendarEvent } from "@/types";

type SyncRow<T> = { id: string; data: T; updated_at: string };

async function pushAll(
  tasks: Task[],
  journals: JournalEntry[],
  events: CalendarEvent[]
): Promise<void> {
  const toRow = <T extends { id: string; updatedAt?: string; createdAt?: string }>(item: T) => ({
    id:         item.id,
    data:       item,
    updated_at: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
  });

  await Promise.all(
    [
      tasks.length    && fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "tasks",    items: tasks.map(toRow)    }) }),
      journals.length && fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "journals", items: journals.map(toRow) }) }),
      events.length   && fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "events",   items: events.map(toRow)   }) }),
    ].filter(Boolean)
  );
}

async function pushDeletes(
  pending: { tasks: string[]; journals: string[]; events: string[] },
  clearPendingDeletes: (type: "tasks" | "journals" | "events", ids?: string[]) => void
): Promise<void> {
  const deleteOne = async (type: "tasks" | "journals" | "events", id: string) => {
    const res = await fetch("/api/sync", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type, id }),
    });
    return res.ok;
  };

  for (const type of ["tasks", "journals", "events"] as const) {
    const ids = pending[type];
    if (!ids.length) continue;
    const successful: string[] = [];
    for (const id of ids) {
      try {
        if (await deleteOne(type, id)) successful.push(id);
      } catch {/* offline / network err — keep in queue */}
    }
    if (successful.length) clearPendingDeletes(type, successful);
  }
}

export function useSyncData() {
  const { data: session }     = useSession();
  const isOnline              = useOnlineStatus();
  const {
    tasks, journals, events, pendingDeletes,
    upsertTask, upsertJournal, upsertEvent,
    clearPendingDeletes,
  } = useAppStore();

  const hasPulled = useRef(false);

  // ── Pull on first mount when online + authenticated ───────────────────────────
  useEffect(() => {
    if (!session?.user || !isOnline || hasPulled.current) return;
    hasPulled.current = true;

    (async () => {
      try {
        // Push any pending deletes FIRST so we don't pull back items we just deleted
        await pushDeletes(useAppStore.getState().pendingDeletes, clearPendingDeletes);

        const res = await fetch("/api/sync");
        if (!res.ok) return;
        const remote = await res.json() as {
          tasks:    SyncRow<Task>[];
          journals: SyncRow<JournalEntry>[];
          events:   SyncRow<CalendarEvent>[];
        };

        // ── Critical fix: preserve remote id when merging ──────────────────
        // The old code called addTask(stripId(...)) which generated a NEW id
        // for every pulled row. That caused exponential duplication:
        //   Pull L1 → add as L2 → push L2 → next pull gets [L1, L2] → add L2 as L3 → ...
        // upsertTask preserves the row's id so the same logical task always
        // resolves to the same local row.

        const recentlyDeleted = useAppStore.getState().pendingDeletes;

        for (const row of remote.tasks) {
          if (recentlyDeleted.tasks.includes(row.id)) continue;
          upsertTask({ ...row.data, id: row.id });
        }
        for (const row of remote.journals) {
          if (recentlyDeleted.journals.includes(row.id)) continue;
          upsertJournal({ ...row.data, id: row.id });
        }
        for (const row of remote.events) {
          if (recentlyDeleted.events.includes(row.id)) continue;
          upsertEvent({ ...row.data, id: row.id });
        }
      } catch {
        // Silent — offline or server error, local data takes precedence
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isOnline]);

  // ── Push every 3 min + on window focus — only when online ────────────────────
  useEffect(() => {
    if (!session?.user || !isOnline) return;

    const push = async () => {
      try {
        // Propagate deletes BEFORE pushing the current state so the server
        // gets the deletions before any upsert of the same id.
        await pushDeletes(useAppStore.getState().pendingDeletes, clearPendingDeletes);
        await pushAll(tasks, journals, events);
      } catch {/* silent */}
    };

    const interval = setInterval(push, 3 * 60 * 1000);
    window.addEventListener("focus", push);
    push(); // immediate push on mount

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", push);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session, isOnline,
    tasks.length, journals.length, events.length,
    pendingDeletes.tasks.length, pendingDeletes.journals.length, pendingDeletes.events.length,
  ]);
}
