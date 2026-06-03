"use client";

import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import {
  Task, JournalEntry, CalendarEvent,
  ThoughtsMessage, UserProfile, DailyStats, Recurrence, Subtask,
} from "@/types";
import { generateId } from "@/lib/utils";
import { format, addDays, addWeeks, addMonths, subDays } from "date-fns";

// ── Throttled localStorage ────────────────────────────────────────────────────
// Default zustand persist writes to localStorage synchronously on EVERY state
// change. With thousands of tasks (legacy duplication bug), JSON.stringify
// alone took 200–500 ms per call, blocking the main thread on every click.
// This wrapper batches writes — at most one localStorage.setItem call per
// 800 ms, with a flush on page unload to avoid losing the latest state.
const pendingWrites = new Map<string, string>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function flushPendingWrites() {
  if (typeof window === "undefined") return;
  for (const [key, value] of pendingWrites) {
    try { window.localStorage.setItem(key, value); } catch {/* quota / disabled */}
  }
  pendingWrites.clear();
  writeTimer = null;
}

if (typeof window !== "undefined") {
  // Flush whatever's pending when the tab is hidden or closed
  window.addEventListener("pagehide",         flushPendingWrites);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingWrites();
  });
}

const throttledLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    // If we have a pending write, return that (more up-to-date than localStorage)
    return pendingWrites.get(name) ?? window.localStorage.getItem(name);
  },
  setItem: (name, value) => {
    pendingWrites.set(name, value);
    if (writeTimer) return;
    writeTimer = setTimeout(flushPendingWrites, 800);
  },
  removeItem: (name) => {
    pendingWrites.delete(name);
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(name); } catch {/* ignore */}
    }
  },
};

const now   = () => new Date().toISOString();
const today = () => format(new Date(), "yyyy-MM-dd");

function nextDueDate(task: Task): string | undefined {
  if (!task.dueDate || !task.recurrence || task.recurrence === "none") return undefined;
  const base = new Date(task.dueDate);
  switch (task.recurrence as Recurrence) {
    case "daily":    return format(addDays(base, 1), "yyyy-MM-dd");
    case "weekdays": {
      let next = addDays(base, 1);
      while ([0, 6].includes(next.getDay())) next = addDays(next, 1);
      return format(next, "yyyy-MM-dd");
    }
    case "weekly":  return format(addWeeks(base, 1),  "yyyy-MM-dd");
    case "monthly": return format(addMonths(base, 1), "yyyy-MM-dd");
    default:        return undefined;
  }
}

/** Count consecutive days (going back from today) where something was done */
function calcStreak(tasks: Task[], journals: JournalEntry[]): number {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = format(subDays(d, i), "yyyy-MM-dd");
    const hadTask    = tasks.some((t) => t.status === "done" && t.updatedAt?.startsWith(dateStr));
    const hadJournal = journals.some((j) => j.createdAt?.startsWith(dateStr));
    if (hadTask || hadJournal) streak++;
    else if (i > 0) break; // gap — streak ends
  }
  return streak;
}

interface AppState {
  profile: UserProfile;
  updateProfile: (u: Partial<UserProfile>) => void;

  tasks: Task[];
  addTask:        (t: Omit<Task, "id" | "createdAt" | "updatedAt">) => Task;
  updateTask:     (id: string, u: Partial<Task>) => void;
  deleteTask:     (id: string) => void;
  completeTask:   (id: string) => void;
  addSubtask:     (taskId: string, title: string) => void;
  toggleSubtask:  (taskId: string, subtaskId: string) => void;
  deleteSubtask:  (taskId: string, subtaskId: string) => void;
  // Sync helpers — preserve remote id, used by useSyncData on pull
  upsertTask:     (task: Task) => void;
  dedupTasks:     () => number;

  journals: JournalEntry[];
  addJournal:    (e: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">) => JournalEntry;
  updateJournal: (id: string, u: Partial<JournalEntry>) => void;
  deleteJournal: (id: string) => void;
  upsertJournal: (entry: JournalEntry) => void;
  dedupJournals: () => number;

  events: CalendarEvent[];
  addEvent:    (e: Omit<CalendarEvent, "id" | "createdAt">) => CalendarEvent;
  updateEvent: (id: string, u: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  upsertEvent: (event: CalendarEvent) => void;
  dedupEvents: () => number;

  // Track deletes so the next push can propagate them to Supabase
  pendingDeletes: { tasks: string[]; journals: string[]; events: string[] };
  clearPendingDeletes: (type: "tasks" | "journals" | "events", ids?: string[]) => void;

  messages: ThoughtsMessage[];
  addMessage:    (m: Omit<ThoughtsMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;

  dailyStats: DailyStats[];
  recordDailyStat: (s: Partial<DailyStats> & { date: string }) => void;

  getStreak: () => number;

  pushSubscription: string | null;
  setPushSubscription: (s: string | null) => void;

  sidebarCollapsed:      boolean;
  toggleSidebar:         () => void;
  thoughtsPanelOpen:     boolean;
  toggleThoughtsPanel:   () => void;
  onboarded:             boolean;
  setOnboarded:          () => void;
  notificationsEnabled:  boolean;
  setNotificationsEnabled: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Profile ──────────────────────────────────────────────────────────
      profile: { name: "", email: "", bio: "", joinedAt: now() },
      updateProfile: (u) => set((s) => ({ profile: { ...s.profile, ...u } })),

      // ── Tasks ────────────────────────────────────────────────────────────
      tasks: [],
      addTask: (task) => {
        const t: Task = { ...task, id: generateId(), createdAt: now(), updatedAt: now() };
        set((s) => ({ tasks: [t, ...s.tasks] }));
        return t;
      },
      updateTask: (id, u) =>
        set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...u, updatedAt: now() } : t) })),
      deleteTask: (id) => set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        pendingDeletes: { ...s.pendingDeletes, tasks: [...s.pendingDeletes.tasks, id] },
      })),
      // Sync upsert — preserves remote id and timestamps, last-write-wins
      upsertTask: (task) => set((s) => {
        const existing = s.tasks.find((t) => t.id === task.id);
        if (!existing) return { tasks: [task, ...s.tasks] };
        const localTs  = existing.updatedAt ?? existing.createdAt ?? "0";
        const remoteTs = task.updatedAt    ?? task.createdAt    ?? "0";
        if (remoteTs > localTs) {
          return { tasks: s.tasks.map((t) => t.id === task.id ? task : t) };
        }
        return s;
      }),
      // Remove duplicate tasks: same title + dueDate + status. Keeps the newest.
      dedupTasks: () => {
        const before = get().tasks.length;
        const keyOf = (t: Task) => `${t.title.trim().toLowerCase()}|${t.dueDate ?? ""}|${t.status}`;
        const groups = new Map<string, Task[]>();
        for (const t of get().tasks) {
          const k = keyOf(t);
          const arr = groups.get(k) ?? [];
          arr.push(t);
          groups.set(k, arr);
        }
        const kept: Task[] = [];
        for (const arr of groups.values()) {
          arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));
          kept.push(arr[0]);
        }
        set({ tasks: kept });
        return before - kept.length;
      },
      completeTask: (id) => {
        const { tasks, addTask } = get();
        const task = tasks.find((t) => t.id === id);
        if (!task) return;
        set((s) => ({
          tasks: s.tasks.map((t) => t.id === id ? { ...t, status: "done" as const, updatedAt: now() } : t),
        }));
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(50);
        if (task.recurrence && task.recurrence !== "none") {
          const next = nextDueDate(task);
          if (next) {
            const rest = { ...task } as Partial<Task>;
            delete rest.id; delete rest.createdAt; delete rest.updatedAt;
            addTask({ ...(rest as Omit<Task, "id" | "createdAt" | "updatedAt">), status: "todo", dueDate: next, parentId: task.parentId ?? task.id });
          }
        }
      },
      addSubtask: (taskId, title) =>
        set((s) => ({
          tasks: s.tasks.map((t) => t.id === taskId ? {
            ...t,
            subtasks: [...(t.subtasks ?? []), { id: generateId(), title, done: false }],
            updatedAt: now(),
          } : t),
        })),
      toggleSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) => t.id === taskId ? {
            ...t,
            subtasks: (t.subtasks ?? []).map((st) => st.id === subtaskId ? { ...st, done: !st.done } : st),
            updatedAt: now(),
          } : t),
        })),
      deleteSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) => t.id === taskId ? {
            ...t,
            subtasks: (t.subtasks ?? []).filter((st) => st.id !== subtaskId),
            updatedAt: now(),
          } : t),
        })),

      // ── Journal ──────────────────────────────────────────────────────────
      journals: [],
      addJournal: (entry) => {
        const e: JournalEntry = { ...entry, id: generateId(), createdAt: now(), updatedAt: now() };
        set((s) => ({ journals: [e, ...s.journals] }));
        return e;
      },
      updateJournal: (id, u) =>
        set((s) => ({ journals: s.journals.map((j) => j.id === id ? { ...j, ...u, updatedAt: now() } : j) })),
      deleteJournal: (id) => set((s) => ({
        journals: s.journals.filter((j) => j.id !== id),
        pendingDeletes: { ...s.pendingDeletes, journals: [...s.pendingDeletes.journals, id] },
      })),
      upsertJournal: (entry) => set((s) => {
        const existing = s.journals.find((j) => j.id === entry.id);
        if (!existing) return { journals: [entry, ...s.journals] };
        const localTs  = existing.updatedAt ?? existing.createdAt ?? "0";
        const remoteTs = entry.updatedAt    ?? entry.createdAt    ?? "0";
        if (remoteTs > localTs) {
          return { journals: s.journals.map((j) => j.id === entry.id ? entry : j) };
        }
        return s;
      }),
      // Dedup journals by title + createdAt date (same minute = same entry)
      dedupJournals: () => {
        const before = get().journals.length;
        const keyOf = (j: JournalEntry) =>
          `${j.title.trim().toLowerCase()}|${(j.createdAt ?? "").slice(0, 16)}`;
        const groups = new Map<string, JournalEntry[]>();
        for (const j of get().journals) {
          const k = keyOf(j);
          const arr = groups.get(k) ?? [];
          arr.push(j);
          groups.set(k, arr);
        }
        const kept: JournalEntry[] = [];
        for (const arr of groups.values()) {
          arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));
          kept.push(arr[0]);
        }
        set({ journals: kept });
        return before - kept.length;
      },

      // ── Calendar ─────────────────────────────────────────────────────────
      events: [],
      addEvent: (event) => {
        const e: CalendarEvent = { ...event, id: generateId(), createdAt: now() };
        set((s) => ({ events: [e, ...s.events] }));
        return e;
      },
      updateEvent: (id, u) =>
        set((s) => ({ events: s.events.map((e) => e.id === id ? { ...e, ...u } : e) })),
      deleteEvent: (id) => set((s) => ({
        events: s.events.filter((e) => e.id !== id),
        pendingDeletes: { ...s.pendingDeletes, events: [...s.pendingDeletes.events, id] },
      })),
      upsertEvent: (event) => set((s) => {
        const existing = s.events.find((e) => e.id === event.id);
        if (!existing) return { events: [event, ...s.events] };
        const localTs  = existing.createdAt ?? "0";
        const remoteTs = event.createdAt    ?? "0";
        if (remoteTs > localTs) {
          return { events: s.events.map((e) => e.id === event.id ? event : e) };
        }
        return s;
      }),
      // Dedup events by title + date + startTime
      dedupEvents: () => {
        const before = get().events.length;
        const keyOf = (e: CalendarEvent) =>
          `${e.title.trim().toLowerCase()}|${e.date}|${e.startTime ?? ""}`;
        const groups = new Map<string, CalendarEvent[]>();
        for (const e of get().events) {
          const k = keyOf(e);
          const arr = groups.get(k) ?? [];
          arr.push(e);
          groups.set(k, arr);
        }
        const kept: CalendarEvent[] = [];
        for (const arr of groups.values()) {
          arr.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
          kept.push(arr[0]);
        }
        set({ events: kept });
        return before - kept.length;
      },

      // ── Pending deletes — synced to server on next push ─────────────────────
      pendingDeletes: { tasks: [], journals: [], events: [] },
      clearPendingDeletes: (type, ids) => set((s) => ({
        pendingDeletes: {
          ...s.pendingDeletes,
          [type]: ids ? s.pendingDeletes[type].filter((id) => !ids.includes(id)) : [],
        },
      })),

      // ── Thoughts AI ──────────────────────────────────────────────────────
      messages: [],
      addMessage: (m) =>
        set((s) => ({ messages: [...s.messages, { ...m, id: generateId(), timestamp: now() }] })),
      clearMessages: () => set({ messages: [] }),

      // ── Analytics ────────────────────────────────────────────────────────
      dailyStats: [],
      recordDailyStat: (stat) =>
        set((s) => {
          const exists = s.dailyStats.find((d) => d.date === stat.date);
          return exists
            ? { dailyStats: s.dailyStats.map((d) => d.date === stat.date ? { ...d, ...stat } : d) }
            : { dailyStats: [...s.dailyStats, { tasksCompleted: 0, tasksCreated: 0, journalEntries: 0, ...stat }] };
        }),

      getStreak: () => calcStreak(get().tasks, get().journals),

      // ── Push ─────────────────────────────────────────────────────────────
      pushSubscription: null,
      setPushSubscription: (s) => set({ pushSubscription: s }),

      // ── UI ────────────────────────────────────────────────────────────────
      sidebarCollapsed:    false,
      toggleSidebar:       () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      thoughtsPanelOpen:   false,
      toggleThoughtsPanel: () => set((s) => ({ thoughtsPanelOpen: !s.thoughtsPanelOpen })),
      onboarded:           false,
      setOnboarded:        () => set({ onboarded: true }),
      notificationsEnabled: false,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
    }),
    {
      name:    "thoughtstack-storage",
      storage: createJSONStorage(() => throttledLocalStorage),
      partialize: (s) => ({
        profile: s.profile, tasks: s.tasks, journals: s.journals,
        events: s.events, messages: s.messages.slice(-50), dailyStats: s.dailyStats,
        pushSubscription: s.pushSubscription, sidebarCollapsed: s.sidebarCollapsed,
        onboarded: s.onboarded, notificationsEnabled: s.notificationsEnabled,
        pendingDeletes: s.pendingDeletes,
      }),
    }
  )
);
