// ─── Shared ───────────────────────────────────────────────────────────────────

export interface Location {
  lat: number;
  lng: number;
  label?: string; // reverse-geocoded address or custom label
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type Priority   = "low" | "medium" | "high" | "critical";
export type TaskStatus = "todo" | "in_progress" | "done";
export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string;    // YYYY-MM-DD
  dueTime?: string;    // HH:mm
  category?: string;
  tags?: string[];     // free-form lowercase tags (e.g. "work", "errand")
  reminder?: boolean;
  recurrence?: Recurrence;
  parentId?: string;   // recurring instances link back to origin
  location?: Location;
  subtasks?: Subtask[];
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
  photos?: string[];   // base64 data URLs
  aiInsight?: string;
  createdAt: string;
  updatedAt: string;
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
  location?: Location;
  reminder?: boolean;
  createdAt: string;
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export interface Habit {
  id:        string;
  name:      string;        // "Drink water", "Read 20 min"
  icon?:     string;        // emoji
  color?:    string;        // tailwind text-* class
  createdAt: string;
  updatedAt: string;
  // completedDates is a sparse map of "YYYY-MM-DD" -> true.
  // We use a map (not array) so toggle is O(1) and JSON storage is compact.
  completedDates: Record<string, true>;
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

/** Snapshot of the user's world — sent to the AI for every message */
export interface ThoughtsContext {
  todayTasks:     Array<{ title: string; priority: string; status: string; dueTime?: string }>;
  todayEvents:    Array<{ title: string; startTime?: string; type: string }>;
  recentJournals: Array<{ title: string; mood?: string; date: string }>;
  stats:          { tasksTotal: number; tasksDone: number; journalCount: number; streak: number };
}

// ─── User / Profile ───────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  joinedAt: string;
}

// ─── Analytics (lightweight) ──────────────────────────────────────────────────

export interface DailyStats {
  date: string;
  tasksCompleted: number;
  tasksCreated: number;
  journalEntries: number;
  mood?: Mood;
}
