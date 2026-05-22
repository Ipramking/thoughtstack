"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Task, JournalEntry, TrackedSkill, CalendarEvent,
  ThoughtsMessage, UserProfile, DailyStats,
  Habit, HabitLog, Recurrence,
} from "@/types";
import { generateId } from "@/lib/utils";
import { format, addDays, addWeeks, addMonths, nextMonday, nextDay } from "date-fns";

// ── helpers ────────────────────────────────────────────────────────────────────
const now  = () => new Date().toISOString();
const today = () => format(new Date(), "yyyy-MM-dd");

/** Given a recurring task that was just completed, return the next due date */
function nextDueDate(task: Task): string | undefined {
  if (!task.dueDate || !task.recurrence || task.recurrence === "none") return undefined;
  const base = new Date(task.dueDate);
  switch (task.recurrence) {
    case "daily":    return format(addDays(base, 1), "yyyy-MM-dd");
    case "weekdays": {
      // Skip to next weekday
      let next = addDays(base, 1);
      while ([0, 6].includes(next.getDay())) next = addDays(next, 1);
      return format(next, "yyyy-MM-dd");
    }
    case "weekly":   return format(addWeeks(base, 1), "yyyy-MM-dd");
    case "monthly":  return format(addMonths(base, 1), "yyyy-MM-dd");
    default:         return undefined;
  }
}

// ── interfaces ─────────────────────────────────────────────────────────────────
interface AppState {
  // Profile
  profile: UserProfile;
  updateProfile: (u: Partial<UserProfile>) => void;

  // Tasks
  tasks: Task[];
  addTask:    (t: Omit<Task, "id" | "createdAt" | "updatedAt">) => Task;
  updateTask: (id: string, u: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  /** Mark done; auto-spawns next recurring instance */
  completeTask: (id: string) => void;

  // Journal
  journals: JournalEntry[];
  addJournal:    (e: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">) => JournalEntry;
  updateJournal: (id: string, u: Partial<JournalEntry>) => void;
  deleteJournal: (id: string) => void;

  // Skills
  skills: TrackedSkill[];
  addSkill:       (s: Omit<TrackedSkill, "id" | "startedAt" | "lastActivity">) => TrackedSkill;
  updateSkill:    (id: string, u: Partial<TrackedSkill>) => void;
  deleteSkill:    (id: string) => void;
  completeMission:(skillId: string, missionId: string) => void;
  completeModule: (skillId: string, moduleId: string) => void;

  // Calendar
  events: CalendarEvent[];
  addEvent:    (e: Omit<CalendarEvent, "id" | "createdAt">) => CalendarEvent;
  updateEvent: (id: string, u: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

  // Habits
  habits: Habit[];
  habitLogs: HabitLog[];
  addHabit:       (h: Omit<Habit, "id" | "createdAt">) => Habit;
  deleteHabit:    (id: string) => void;
  toggleHabitLog: (habitId: string, date: string) => void;
  getHabitStreak: (habitId: string) => number;
  isHabitDone:    (habitId: string, date: string) => boolean;

  // Thoughts AI
  messages: ThoughtsMessage[];
  addMessage:    (m: Omit<ThoughtsMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;

  // Analytics
  dailyStats: DailyStats[];
  recordDailyStat: (s: Partial<DailyStats> & { date: string }) => void;

  // UI / onboarding
  sidebarCollapsed:     boolean;
  toggleSidebar:        () => void;
  thoughtsPanelOpen:    boolean;
  toggleThoughtsPanel:  () => void;
  onboarded:            boolean;
  setOnboarded:         () => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Profile ──────────────────────────────────────────────────────────
      profile: { name: "User", email: "", bio: "", joinedAt: now() },
      updateProfile: (u) => set((s) => ({ profile: { ...s.profile, ...u } })),

      // ── Tasks ────────────────────────────────────────────────────────────
      tasks: [],
      addTask: (task) => {
        const t: Task = { ...task, id: generateId(), createdAt: now(), updatedAt: now() };
        set((s) => ({ tasks: [t, ...s.tasks] }));
        return t;
      },
      updateTask: (id, u) =>
        set((s) => ({
          tasks: s.tasks.map((t) => t.id === id ? { ...t, ...u, updatedAt: now() } : t),
        })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      completeTask: (id) => {
        const { tasks, addTask } = get();
        const task = tasks.find((t) => t.id === id);
        if (!task) return;
        // mark done
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, status: "done" as const, updatedAt: now() } : t
          ),
        }));
        // spawn next recurring instance
        if (task.recurrence && task.recurrence !== "none") {
          const next = nextDueDate(task);
          if (next) {
            addTask({
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: "todo",
              dueDate: next,
              dueTime: task.dueTime,
              category: task.category,
              reminder: task.reminder,
              recurrence: task.recurrence,
              parentId: task.parentId ?? task.id,
            });
          }
        }
      },

      // ── Journal ──────────────────────────────────────────────────────────
      journals: [],
      addJournal: (entry) => {
        const e: JournalEntry = { ...entry, id: generateId(), createdAt: now(), updatedAt: now() };
        set((s) => ({ journals: [e, ...s.journals] }));
        return e;
      },
      updateJournal: (id, u) =>
        set((s) => ({
          journals: s.journals.map((j) => j.id === id ? { ...j, ...u, updatedAt: now() } : j),
        })),
      deleteJournal: (id) => set((s) => ({ journals: s.journals.filter((j) => j.id !== id) })),

      // ── Skills ───────────────────────────────────────────────────────────
      skills: [],
      addSkill: (skill) => {
        const sk: TrackedSkill = { ...skill, id: generateId(), startedAt: now(), lastActivity: now() };
        set((s) => ({ skills: [sk, ...s.skills] }));
        return sk;
      },
      updateSkill: (id, u) =>
        set((s) => ({
          skills: s.skills.map((sk) => sk.id === id ? { ...sk, ...u, lastActivity: now() } : sk),
        })),
      deleteSkill: (id) => set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),
      completeMission: (skillId, missionId) =>
        set((s) => ({
          skills: s.skills.map((sk) => {
            if (sk.id !== skillId) return sk;
            const mission = sk.missions.find((m) => m.id === missionId);
            const xpGain  = mission?.xp ?? 0;
            const newXp   = sk.xp + xpGain;
            const newLevel = Math.floor(newXp / 500) + 1;
            const progress = Math.min(100, (newXp % 500) / 5);
            return {
              ...sk, xp: newXp, totalXp: sk.totalXp + xpGain,
              level: newLevel, progress, lastActivity: now(),
              missions: sk.missions.map((m) =>
                m.id === missionId ? { ...m, status: "completed" as const } : m
              ),
            };
          }),
        })),
      completeModule: (skillId, moduleId) =>
        set((s) => ({
          skills: s.skills.map((sk) => {
            if (sk.id !== skillId) return sk;
            const done = sk.modules.filter((m) => m.completed).length + 1;
            const progress = Math.round((done / sk.modules.length) * 100);
            return {
              ...sk, progress, lastActivity: now(),
              modules: sk.modules.map((m) => m.id === moduleId ? { ...m, completed: true } : m),
            };
          }),
        })),

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

      // ── Habits ───────────────────────────────────────────────────────────
      habits: [],
      habitLogs: [],
      addHabit: (h) => {
        const habit: Habit = { ...h, id: generateId(), createdAt: now() };
        set((s) => ({ habits: [habit, ...s.habits] }));
        return habit;
      },
      deleteHabit: (id) =>
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          habitLogs: s.habitLogs.filter((l) => l.habitId !== id),
        })),
      toggleHabitLog: (habitId, date) =>
        set((s) => {
          const exists = s.habitLogs.some((l) => l.habitId === habitId && l.date === date);
          return {
            habitLogs: exists
              ? s.habitLogs.filter((l) => !(l.habitId === habitId && l.date === date))
              : [...s.habitLogs, { habitId, date }],
          };
        }),
      isHabitDone: (habitId, date) =>
        get().habitLogs.some((l) => l.habitId === habitId && l.date === date),
      getHabitStreak: (habitId) => {
        const logs = get().habitLogs.filter((l) => l.habitId === habitId);
        const done = new Set(logs.map((l) => l.date));
        let streak = 0;
        const d = new Date();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const key = format(d, "yyyy-MM-dd");
          if (!done.has(key)) break;
          streak++;
          d.setDate(d.getDate() - 1);
        }
        return streak;
      },

      // ── Thoughts AI ──────────────────────────────────────────────────────
      messages: [],
      addMessage: (m) =>
        set((s) => ({
          messages: [...s.messages, { ...m, id: generateId(), timestamp: now() }],
        })),
      clearMessages: () => set({ messages: [] }),

      // ── Analytics ────────────────────────────────────────────────────────
      dailyStats: [],
      recordDailyStat: (stat) =>
        set((s) => {
          const exists = s.dailyStats.find((d) => d.date === stat.date);
          return exists
            ? { dailyStats: s.dailyStats.map((d) => d.date === stat.date ? { ...d, ...stat } : d) }
            : { dailyStats: [...s.dailyStats, { tasksCompleted: 0, tasksCreated: 0, journalEntries: 0, studyMinutes: 0, ...stat }] };
        }),

      // ── UI ────────────────────────────────────────────────────────────────
      sidebarCollapsed: false,
      toggleSidebar:    () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      thoughtsPanelOpen: false,
      toggleThoughtsPanel: () => set((s) => ({ thoughtsPanelOpen: !s.thoughtsPanelOpen })),
      onboarded: false,
      setOnboarded: () => set({ onboarded: true }),
      notificationsEnabled: false,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
    }),
    {
      name: "thoughtstack-storage",
      partialize: (s) => ({
        profile:              s.profile,
        tasks:                s.tasks,
        journals:             s.journals,
        skills:               s.skills,
        events:               s.events,
        habits:               s.habits,
        habitLogs:            s.habitLogs,
        messages:             s.messages,
        dailyStats:           s.dailyStats,
        sidebarCollapsed:     s.sidebarCollapsed,
        onboarded:            s.onboarded,
        notificationsEnabled: s.notificationsEnabled,
      }),
    }
  )
);
