"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Task, JournalEntry, CalendarEvent,
  ThoughtsMessage, UserProfile, DailyStats, Recurrence, Subtask,
} from "@/types";
import { generateId } from "@/lib/utils";
import { format, addDays, addWeeks, addMonths, subDays } from "date-fns";

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

  journals: JournalEntry[];
  addJournal:    (e: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">) => JournalEntry;
  updateJournal: (id: string, u: Partial<JournalEntry>) => void;
  deleteJournal: (id: string) => void;

  events: CalendarEvent[];
  addEvent:    (e: Omit<CalendarEvent, "id" | "createdAt">) => CalendarEvent;
  updateEvent: (id: string, u: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

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
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
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
      deleteJournal: (id) => set((s) => ({ journals: s.journals.filter((j) => j.id !== id) })),

      // ── Calendar ─────────────────────────────────────────────────────────
      events: [],
      addEvent: (event) => {
        const e: CalendarEvent = { ...event, id: generateId(), createdAt: now() };
        set((s) => ({ events: [e, ...s.events] }));
        return e;
      },
      updateEvent: (id, u) =>
        set((s) => ({ events: s.events.map((e) => e.id === id ? { ...e, ...u } : e) })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

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
      name: "thoughtstack-storage",
      partialize: (s) => ({
        profile: s.profile, tasks: s.tasks, journals: s.journals,
        events: s.events, messages: s.messages, dailyStats: s.dailyStats,
        pushSubscription: s.pushSubscription, sidebarCollapsed: s.sidebarCollapsed,
        onboarded: s.onboarded, notificationsEnabled: s.notificationsEnabled,
      }),
    }
  )
);
