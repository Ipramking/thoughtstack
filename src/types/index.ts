// ─── Tasks ────────────────────────────────────────────────────────────────────

export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string; // ISO string
  dueTime?: string; // "HH:mm"
  category?: string;
  reminder?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export type Mood = "great" | "good" | "neutral" | "bad" | "awful";

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
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
  progress: number; // 0-100
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
  date: string; // ISO string (date)
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  allDay?: boolean;
  color?: string;
  taskId?: string; // linked task
  reminder?: boolean;
  createdAt: string;
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

// ─── User / Profile ───────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string; // base64 or URL
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
