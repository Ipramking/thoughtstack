import { ThoughtsAction, ThoughtsContext } from "@/types";

export interface ThoughtsResponse {
  reply: string;
  actions: ThoughtsAction[];
  provider?: "claude" | "gemini" | "local";
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────

const PRIORITY_KW = {
  critical: ["urgent", "asap", "critical", "emergency", "immediately", "deadline today"],
  high:     ["important", "high priority", "must", "need to", "have to", "required"],
  medium:   ["should", "plan to", "want to", "upcoming"],
  low:      ["maybe", "someday", "eventually", "optional", "would like"],
};

const TIME_PATTERNS = [
  { pattern: /\btomorrow\b/i,      offset: 1 },
  { pattern: /\btoday\b/i,         offset: 0 },
  { pattern: /\bnext week\b/i,     offset: 7 },
  { pattern: /\bin (\d+) days?\b/i, group: 1 },
];

const HOUR_PATTERN = /\bat?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

function detectPriority(text: string): "low" | "medium" | "high" | "critical" {
  const lower = text.toLowerCase();
  for (const [level, kws] of Object.entries(PRIORITY_KW)) {
    if (kws.some((k) => lower.includes(k))) return level as "low" | "medium" | "high" | "critical";
  }
  return "medium";
}

function detectDate(text: string): string | undefined {
  for (const tp of TIME_PATTERNS) {
    const match = text.match(tp.pattern);
    if (match) {
      const d = new Date();
      if ("offset" in tp) d.setDate(d.getDate() + (tp.offset ?? 0));
      else if ("group" in tp && tp.group) d.setDate(d.getDate() + parseInt(match[tp.group!]));
      return d.toISOString().split("T")[0];
    }
  }
}

function detectTime(text: string): string | undefined {
  const m = text.match(HOUR_PATTERN);
  if (!m) return undefined;
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  const mer = m[3]?.toLowerCase();
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function detectTasks(text: string): string[] {
  const pats = [
    /(?:need to|have to|must|should|want to|going to|plan to)\s+(.+?)(?:\.|,|and|$)/gi,
    /(?:finish|complete|do|write|build|create|fix|review|update)\s+(.+?)(?:\.|,|and|$)/gi,
  ];
  const tasks: string[] = [];
  for (const p of pats) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) {
      const t = m[1].trim();
      if (t.length > 3 && t.length < 100) tasks.push(t);
    }
  }
  return [...new Set(tasks)];
}

function ruleBased(text: string, context?: ThoughtsContext): ThoughtsResponse {
  const lower = text.toLowerCase();
  const actions: ThoughtsAction[] = [];

  // Greetings
  if (/^(hi|hello|hey|sup)\b/i.test(lower)) {
    const name = ""; // could be passed from context if needed
    return {
      reply: `Hey${name ? " " + name : ""}! I'm Thoughts, your AI assistant. Ask me about your tasks, habits, schedule, or anything on your mind.`,
      actions: [], provider: "local",
    };
  }

  // Context-aware answers using local rule engine
  if (context) {
    // "What should I focus on today?" / "what do I have today?"
    if (/focus|today|priority|important/i.test(lower)) {
      const pending = context.todayTasks.filter((t) => t.status !== "done");
      if (pending.length > 0) {
        const top = pending.slice(0, 3).map((t) => `• ${t.title} (${t.priority})`).join("\n");
        return {
          reply: `Here's what needs your attention today:\n${top}\n\nI'd start with the highest priority items first. Want me to help you plan your time?`,
          actions: [], provider: "local",
        };
      }
      if (context.todayEvents.length > 0) {
        const ev = context.todayEvents.map((e) => `• ${e.title}${e.startTime ? ` at ${e.startTime}` : ""}`).join("\n");
        return { reply: `No tasks due today, but you have:\n${ev}\n\nLooks like a lighter day — good time to work on your skills or journal!`, actions: [], provider: "local" };
      }
      return { reply: "Your slate is clear today! Great time to get ahead — want me to help you plan something?", actions: [], provider: "local" };
    }

    // Stats / how am I doing
    if (/how am i|progress|stats|doing/i.test(lower)) {
      const { tasksTotal, tasksDone, journalCount } = context.stats;
      const rate = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;
      const recentMood = context.recentJournals[0]?.mood;
      return {
        reply: `Here's your snapshot:\n• Task completion: ${tasksDone}/${tasksTotal} (${rate}%)\n• Journal entries: ${journalCount}\n• Recent mood: ${recentMood ?? "no data"}\n\nYou're doing ${rate > 60 ? "well" : "okay"} — ${rate > 60 ? "keep it up!" : "let's push a bit harder today."}`,
        actions: [], provider: "local",
      };
    }
  }

  // Task detection
  const detectedTasks = detectTasks(text);
  const date = detectDate(text);
  const time = detectTime(text);
  const priority = detectPriority(text);

  for (const title of detectedTasks.slice(0, 3)) {
    actions.push({
      type: "create_task",
      label: `Create task: "${title}"`,
      data: { title: title.charAt(0).toUpperCase() + title.slice(1), priority, dueDate: date, dueTime: time },
    });
  }

  const meetingMatch = text.match(/(?:meeting|call|session|event|appointment)\s+(?:about\s+)?(.+?)(?:\s+at|\s+on|\s+by|$)/i);
  if (meetingMatch && (date || time)) {
    actions.push({
      type: "create_event",
      label: `Add to calendar: "${meetingMatch[1].trim()}"`,
      data: { title: meetingMatch[1].trim(), date: date ?? new Date().toISOString().split("T")[0], startTime: time, type: "meeting" },
    });
  }

  const stressWords = ["stressed", "anxious", "overwhelmed", "worried", "exhausted", "burned out"];
  const hasStress = stressWords.some((w) => lower.includes(w));

  let reply = "";
  if (actions.length > 0) {
    reply = `I spotted ${actions.length} action${actions.length > 1 ? "s" : ""} from what you said`;
    if (date) reply += ` — targeting ${date === new Date().toISOString().split("T")[0] ? "today" : "an upcoming date"}`;
    reply += `. I've prepared them below — tap to apply.`;
    if (priority === "high" || priority === "critical") reply += " These look high priority.";
  } else if (hasStress) {
    reply = "I'm picking up some stress. Break it into small steps — can I turn anything you said into a task to make it feel more manageable?";
    actions.push({ type: "journal_insight", label: "Log this as a journal entry", data: { content: text, mood: "bad" } });
  } else if (/schedule|plan/i.test(lower)) {
    reply = "Want me to help you build a plan? Tell me what needs to get done and by when.";
  } else if (/learn|study|skill/i.test(lower)) {
    reply = "Great mindset! Head to Skills and I'll generate a mission plan for any skill you want to track. What are you learning?";
  } else {
    reply = "Got it. Are there tasks, deadlines, or events I should help you track? Describe what you're working on naturally.";
  }

  return { reply, actions, provider: "local" };
}

// ─── Main: API → fallback chain ───────────────────────────────────────────────

export async function callThoughts(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  context?: ThoughtsContext,
): Promise<ThoughtsResponse> {
  try {
    const res = await fetch("/api/thoughts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, history, context }),
    });

    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      if (body?.error === "all_providers_failed") return ruleBased(userMessage, context);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as ThoughtsResponse;
  } catch {
    return ruleBased(userMessage, context);
  }
}
