"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Task,
  JournalEntry,
  TrackedSkill,
  CalendarEvent,
  ThoughtsMessage,
  UserProfile,
  DailyStats,
} from "@/types";
import { generateId } from "@/lib/utils";

interface AppState {
  // ─── Profile ─────────────────────────────────────────────────────────
  profile: UserProfile;
  updateProfile: (update: Partial<UserProfile>) => void;

  // ─── Tasks ───────────────────────────────────────────────────────────
  tasks: Task[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => Task;
  updateTask: (id: string, update: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  // ─── Journal ─────────────────────────────────────────────────────────
  journals: JournalEntry[];
  addJournal: (
    entry: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">
  ) => JournalEntry;
  updateJournal: (id: string, update: Partial<JournalEntry>) => void;
  deleteJournal: (id: string) => void;

  // ─── Skills ───────────────────────────────────────────────────────────
  skills: TrackedSkill[];
  addSkill: (skill: Omit<TrackedSkill, "id" | "startedAt" | "lastActivity">) => TrackedSkill;
  updateSkill: (id: string, update: Partial<TrackedSkill>) => void;
  deleteSkill: (id: string) => void;
  completeMission: (skillId: string, missionId: string) => void;
  completeModule: (skillId: string, moduleId: string) => void;

  // ─── Calendar ─────────────────────────────────────────────────────────
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, "id" | "createdAt">) => CalendarEvent;
  updateEvent: (id: string, update: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

  // ─── Thoughts AI ──────────────────────────────────────────────────────
  messages: ThoughtsMessage[];
  addMessage: (msg: Omit<ThoughtsMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;

  // ─── Analytics ────────────────────────────────────────────────────────
  dailyStats: DailyStats[];
  recordDailyStat: (stat: Partial<DailyStats> & { date: string }) => void;

  // ─── UI ───────────────────────────────────────────────────────────────
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  thoughtsPanelOpen: boolean;
  toggleThoughtsPanel: () => void;
}

const now = () => new Date().toISOString();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ─── Profile ───────────────────────────────────────────────────────
      profile: {
        name: "User",
        email: "",
        bio: "",
        joinedAt: now(),
      },
      updateProfile: (update) =>
        set((s) => ({ profile: { ...s.profile, ...update } })),

      // ─── Tasks ─────────────────────────────────────────────────────────
      tasks: [],
      addTask: (task) => {
        const newTask: Task = {
          ...task,
          id: generateId(),
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ tasks: [newTask, ...s.tasks] }));
        return newTask;
      },
      updateTask: (id, update) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...update, updatedAt: now() } : t
          ),
        })),
      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      // ─── Journal ───────────────────────────────────────────────────────
      journals: [],
      addJournal: (entry) => {
        const newEntry: JournalEntry = {
          ...entry,
          id: generateId(),
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ journals: [newEntry, ...s.journals] }));
        return newEntry;
      },
      updateJournal: (id, update) =>
        set((s) => ({
          journals: s.journals.map((j) =>
            j.id === id ? { ...j, ...update, updatedAt: now() } : j
          ),
        })),
      deleteJournal: (id) =>
        set((s) => ({ journals: s.journals.filter((j) => j.id !== id) })),

      // ─── Skills ────────────────────────────────────────────────────────
      skills: [],
      addSkill: (skill) => {
        const newSkill: TrackedSkill = {
          ...skill,
          id: generateId(),
          startedAt: now(),
          lastActivity: now(),
        };
        set((s) => ({ skills: [newSkill, ...s.skills] }));
        return newSkill;
      },
      updateSkill: (id, update) =>
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, ...update, lastActivity: now() } : sk
          ),
        })),
      deleteSkill: (id) =>
        set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),
      completeMission: (skillId, missionId) =>
        set((s) => ({
          skills: s.skills.map((sk) => {
            if (sk.id !== skillId) return sk;
            const mission = sk.missions.find((m) => m.id === missionId);
            const xpGain = mission?.xp ?? 0;
            const newXp = sk.xp + xpGain;
            const newLevel = Math.floor(newXp / 500) + 1;
            const newProgress = Math.min(100, (newXp % 500) / 5);
            return {
              ...sk,
              xp: newXp,
              totalXp: sk.totalXp + xpGain,
              level: newLevel,
              progress: newProgress,
              lastActivity: now(),
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
            const completedModules = sk.modules.filter((m) => m.completed).length + 1;
            const newProgress = Math.round((completedModules / sk.modules.length) * 100);
            return {
              ...sk,
              progress: newProgress,
              lastActivity: now(),
              modules: sk.modules.map((m) =>
                m.id === moduleId ? { ...m, completed: true } : m
              ),
            };
          }),
        })),

      // ─── Calendar ──────────────────────────────────────────────────────
      events: [],
      addEvent: (event) => {
        const newEvent: CalendarEvent = {
          ...event,
          id: generateId(),
          createdAt: now(),
        };
        set((s) => ({ events: [newEvent, ...s.events] }));
        return newEvent;
      },
      updateEvent: (id, update) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id ? { ...e, ...update } : e
          ),
        })),
      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      // ─── Thoughts ──────────────────────────────────────────────────────
      messages: [],
      addMessage: (msg) =>
        set((s) => ({
          messages: [
            ...s.messages,
            { ...msg, id: generateId(), timestamp: now() },
          ],
        })),
      clearMessages: () => set({ messages: [] }),

      // ─── Analytics ─────────────────────────────────────────────────────
      dailyStats: [],
      recordDailyStat: (stat) =>
        set((s) => {
          const existing = s.dailyStats.find((d) => d.date === stat.date);
          if (existing) {
            return {
              dailyStats: s.dailyStats.map((d) =>
                d.date === stat.date ? { ...d, ...stat } : d
              ),
            };
          }
          return {
            dailyStats: [
              ...s.dailyStats,
              {
                tasksCompleted: 0,
                tasksCreated: 0,
                journalEntries: 0,
                studyMinutes: 0,
                ...stat,
              },
            ],
          };
        }),

      // ─── UI ────────────────────────────────────────────────────────────
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      thoughtsPanelOpen: false,
      toggleThoughtsPanel: () =>
        set((s) => ({ thoughtsPanelOpen: !s.thoughtsPanelOpen })),
    }),
    {
      name: "thoughtstack-storage",
      partialize: (state) => ({
        profile: state.profile,
        tasks: state.tasks,
        journals: state.journals,
        skills: state.skills,
        events: state.events,
        messages: state.messages,
        dailyStats: state.dailyStats,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
