// ─── Tasks ────────────────────────────────────────────────────────────────────

export type Priority  = "low" | "medium" | "high" | "critical";
export type TaskStatus = "todo" | "in_progress" | "done";
export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;   // YYYY-MM-DD
  dueTime?: string;   // HH:mm
  category?: string;
  reminder?: boolean;
  recurrence?: Recurrence;
  parentId?: string;  // for recurring instances
  createdAt: string;
  updatedAt: string;
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export type Mood = "great" | "good" | "neutral" | "bad" | "awful";

export interface JournalEntry {
  id: string;
  title: string;
  content: string;   // markdown-compatible plain text
  mood?: Mood;
  tags: string[];
  folder?: string;
  aiInsight?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Skills & Learning ────────────────────────────────────────────────────────

export type SkillCategory =
  | "Web3"
  | "Programming"
  | "UI/UX"
  | "Game Development"
  | "Productivity"
  | "Branding & Marketing"
  | "AI Tools Mastery"
  | "Crypto Trading";

export type MissionStatus = "locked" | "active" | "completed";

export interface Mission {
  id: string;
  title: string;
  description: string;
  xp: number;
  status: MissionStatus;
  dueDate?: string;
}

export interface SkillModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  completed: boolean;
  order: number;
}

export interface TrackedSkill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  progress: number; // 0–100
  level: number;
  xp: number;
  totalXp: number;
  missions: Mission[];
  modules: SkillModule[];
  startedAt: string;
  lastActivity: string;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export type EventType = "task" | "meeting" | "reminder" | "personal" | "study";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  date: string;        // YYYY-MM-DD
  startTime?: string;  // HH:mm
  endTime?: string;    // HH:mm
  allDay?: boolean;
  color?: string;
  taskId?: string;
  reminder?: boolean;
  createdAt: string;
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export type HabitFrequency = "daily" | "weekdays" | "weekends" | "weekly";

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;   // e.g. "green", "blue", "orange" — maps to Tailwind colour classes
  frequency: HabitFrequency;
  targetDays?: number[]; // 0-6 (Sun-Sat) for "weekly" frequency
  createdAt: string;
}

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD
}

// ─── Thoughts AI ──────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export interface ThoughtsMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  actions?: ThoughtsAction[];
}

export interface ThoughtsAction {
  type: "create_task" | "create_event" | "journal_insight" | "schedule_block";
  label: string;
  data: Record<string, unknown>;
}

// Context passed to the AI from the current store state
export interface ThoughtsContext {
  todayTasks:    Array<{ title: string; priority: string; status: string; dueTime?: string }>;
  todayEvents:   Array<{ title: string; startTime?: string; type: string }>;
  recentJournals:Array<{ title: string; mood?: string; date: string }>;
  habits:        Array<{ name: string; doneToday: boolean; streak: number }>;
  stats:         { tasksTotal: number; tasksDone: number; skillCount: number };
}

// ─── User / Profile ───────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  joinedAt: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface DailyStats {
  date: string;
  tasksCompleted: number;
  tasksCreated: number;
  journalEntries: number;
  mood?: Mood;
  studyMinutes: number;
}
