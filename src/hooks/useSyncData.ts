"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/store/useAppStore";
import { useOnlineStatus } from "./useOnlineStatus";
import { Task, JournalEntry, CalendarEvent } from "@/types";

type SyncRow<T> = { id: string; data: T; updated_at: string };

// EMERGENCY GUARDRAIL: never push more than this many items per request.
// Past this size, JSON.stringify blocks the main thread for hundreds of ms
// on mobile, and the request body can exceed Supabase / Vercel limits.
const CHUNK_SIZE = 100;

// Hard ceiling: if local data ever exceeds this, we refuse to push anything
// until the user runs "Remove duplicates". Prevents catastrophic uploads.
const MAX_ITEMS_PER_TYPE = 5000;

async function pushChunked<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  type: "tasks" | "journals" | "events",
  items: T[],
): Promise<void> {
  if (!items.length) return;
  if (items.length > MAX_ITEMS_PER_TYPE) {
    console.warn(`[sync] Refusing to push ${items.length} ${type} — exceeds safety cap. Run "Remove duplicates" in Settings.`);
    return;
  }

  const toRow = (item: T) => ({
    id:         item.id,
    data:       item,
    updated_at: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
  });

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE).map(toRow);
    try {
      await fetch("/api/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, items: chunk }),
      });
    } catch {/* silent */}
  }
}

async function pushAll(
  tasks: Task[],
  journals: JournalEntry[],
  events: CalendarEvent[],
): Promise<void> {
  // Sequential, NOT parallel — running three concurrent multi-MB uploads on
  // a phone is what was killing devices.
  await pushChunked("tasks", tasks);
  await pushChunked("journals", journals);
  await pushChunked("events", events);
}

async function pushDeletes(
  pending: { tasks: string[]; journals: string[]; events: string[] },
  clearPendingDeletes: (type: "tasks" | "journals" | "events", ids?: string[]) => void,
): Promise<void> {
  for (const type of ["tasks", "journals", "events"] as const) {
    const ids = pending[type];
    if (!ids.length) continue;

    // Chunk the batch so a 5000-id pendingDeletes queue doesn't blow request limits
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      try {
        const res = await fetch("/api/sync", {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ type, ids: chunk }),
        });
        if (res.ok) clearPendingDeletes(type, chunk);
      } catch {/* offline — keep in queue */}
    }
  }
}

export function useSyncData() {
  const { data: session } = useSession();
  const isOnline          = useOnlineStatus();

  // Subscribe to ONLY the fields we need, not the whole store, so this
  // component doesn't re-render on unrelated state changes (sidebar toggles, etc).
  const upsertTask    = useAppStore((s) => s.upsertTask);
  const upsertJournal = useAppStore((s) => s.upsertJournal);
  const upsertEvent   = useAppStore((s) => s.upsertEvent);
  const clearPendingDeletes = useAppStore((s) => s.clearPendingDeletes);

  const hasPulled  = useRef(false);
  const isPushing  = useRef(false);
  const lastPushAt = useRef(0);

  const deleteTask    = useAppStore((s) => s.deleteTask);
  const deleteJournal = useAppStore((s) => s.deleteJournal);
  const deleteEvent   = useAppStore((s) => s.deleteEvent);

  // ── Pull once per session ────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user || !isOnline || hasPulled.current) return;
    hasPulled.current = true;

    (async () => {
      try {
        // Push pending deletes first so the server has them before we pull
        await pushDeletes(useAppStore.getState().pendingDeletes, clearPendingDeletes);

        const res = await fetch("/api/sync");
        if (!res.ok) return;
        const remote = await res.json() as {
          tasks:      SyncRow<Task>[];
          journals:   SyncRow<JournalEntry>[];
          events:     SyncRow<CalendarEvent>[];
          tombstones?: { tasks: string[]; journals: string[]; events: string[] };
        };

        // 1. Apply tombstones — items deleted on other devices must be removed
        //    here too. Each delete also adds the id to local pendingDeletes,
        //    which is fine since the server already knows about it.
        const tombstones = remote.tombstones ?? { tasks: [], journals: [], events: [] };
        const localTasks    = useAppStore.getState().tasks;
        const localJournals = useAppStore.getState().journals;
        const localEvents   = useAppStore.getState().events;
        const tombTaskSet   = new Set(tombstones.tasks);
        const tombJournalSet = new Set(tombstones.journals);
        const tombEventSet  = new Set(tombstones.events);

        for (const t of localTasks)    if (tombTaskSet.has(t.id))    deleteTask(t.id);
        for (const j of localJournals) if (tombJournalSet.has(j.id)) deleteJournal(j.id);
        for (const e of localEvents)   if (tombEventSet.has(e.id))   deleteEvent(e.id);

        // 2. Upsert remote rows that are NOT tombstoned AND NOT in our pending-delete queue
        const recentlyDeleted = useAppStore.getState().pendingDeletes;

        for (const row of remote.tasks) {
          if (tombTaskSet.has(row.id))                    continue;
          if (recentlyDeleted.tasks.includes(row.id))     continue;
          upsertTask({ ...row.data, id: row.id });
        }
        for (const row of remote.journals) {
          if (tombJournalSet.has(row.id))                 continue;
          if (recentlyDeleted.journals.includes(row.id))  continue;
          upsertJournal({ ...row.data, id: row.id });
        }
        for (const row of remote.events) {
          if (tombEventSet.has(row.id))                   continue;
          if (recentlyDeleted.events.includes(row.id))    continue;
          upsertEvent({ ...row.data, id: row.id });
        }
      } catch {/* silent */}
    })();
  }, [session, isOnline, upsertTask, upsertJournal, upsertEvent, deleteTask, deleteJournal, deleteEvent, clearPendingDeletes]);

  // ── Periodic push (every 5 min) — NOT on every state change or focus ─────────
  useEffect(() => {
    if (!session?.user || !isOnline) return;

    const push = async () => {
      // Reentrancy guard — never run two pushes in parallel
      if (isPushing.current) return;
      // Throttle — refuse to push more often than once per 60 seconds
      if (Date.now() - lastPushAt.current < 60_000) return;

      isPushing.current = true;
      try {
        const { tasks, journals, events, pendingDeletes } = useAppStore.getState();
        await pushDeletes(pendingDeletes, clearPendingDeletes);
        await pushAll(tasks, journals, events);
        lastPushAt.current = Date.now();
      } catch {/* silent */}
      finally {
        isPushing.current = false;
      }
    };

    // First push after 30 s grace period (let initial pull settle)
    const initial = setTimeout(push, 30_000);
    const interval = setInterval(push, 5 * 60 * 1000);

    // Listen for BACKGROUND_SYNC messages from the SW (Background Sync API).
    // When the network returns after offline, the SW pings us to flush queued data.
    const swListener = (e: MessageEvent) => {
      if (e.data?.type === "BACKGROUND_SYNC") {
        lastPushAt.current = 0; // bypass throttle for one cycle
        void push();
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", swListener);
    }

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", swListener);
      }
    };
  }, [session, isOnline, clearPendingDeletes]);
}
