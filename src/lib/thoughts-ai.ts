import { ThoughtsAction } from "@/types";

export interface ThoughtsResponse {
  reply: string;
  actions: ThoughtsAction[];
  provider?: "claude" | "gemini" | "local";
}

// ─── Rule-based fallback engine ───────────────────────────────────────────────

const PRIORITY_KEYWORDS = {
  critical: ["urgent", "asap", "critical", "emergency", "immediately", "deadline today"],
  high: ["important", "high priority", "must", "need to", "have to", "required"],
  medium: ["should", "plan to", "want to", "upcoming"],
  low: ["maybe", "someday", "eventually", "optional", "would like"],
};

const TIME_PATTERNS = [
  { pattern: /\btomorrow\b/i, offset: 1 },
  { pattern: /\btoday\b/i, offset: 0 },
  { pattern: /\bnext week\b/i, offset: 7 },
  { pattern: /\bin (\d+) days?\b/i, group: 1 },
];

const HOUR_PATTERN = /\bat?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

function detectPriority(text: string): "low" | "medium" | "high" | "critical" {
  const lower = text.toLowerCase();
  for (const [level, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return level as "low" | "medium" | "high" | "critical";
    }
  }
  return "medium";
}

function detectDate(text: string): string | undefined {
  for (const tp of TIME_PATTERNS) {
    const match = text.match(tp.pattern);
    if (match) {
      const d = new Date();
      if ("offset" in tp) {
        d.setDate(d.getDate() + (tp.offset ?? 0));
      } else if ("group" in tp && tp.group) {
        d.setDate(d.getDate() + parseInt(match[tp.group]));
      }
      return d.toISOString().split("T")[0];
    }
  }
  return undefined;
}

function detectTime(text: string): string | undefined {
  const match = text.match(HOUR_PATTERN);
  if (!match) return undefined;
  let hour = parseInt(match[1]);
  const minute = match[2] ? parseInt(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function detectTasks(text: string): string[] {
  const taskIndicators = [
    /(?:need to|have to|must|should|want to|going to|plan to)\s+(.+?)(?:\.|,|and|$)/gi,
    /(?:finish|complete|do|write|build|create|fix|review|update)\s+(.+?)(?:\.|,|and|$)/gi,
  ];
  const tasks: string[] = [];
  for (const pattern of taskIndicators) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const task = m[1].trim();
      if (task.length > 3 && task.length < 100) tasks.push(task);
    }
  }
  return Array.from(new Set(tasks));
}

function ruleBased(userText: string): ThoughtsResponse {
  const lower = userText.toLowerCase();
  const actions: ThoughtsAction[] = [];

  const isGreeting = /^(hi|hello|hey|sup|what'?s up)\b/i.test(lower);
  if (isGreeting) {
    return {
      reply:
        "Hey! I'm Thoughts, your AI assistant. I can help you manage tasks, journal insights, schedule events, or give productivity advice. What's on your mind?",
      actions: [],
      provider: "local",
    };
  }

  const isAskingAboutMe = /what (can|do) you do|who are you|help me/i.test(lower);
  if (isAskingAboutMe) {
    return {
      reply:
        "I'm Thoughts — your personal AI inside ThoughtStack. I can:\n\n• Create and prioritize tasks from what you tell me\n• Schedule events and detect times automatically\n• Analyze your journal entries for patterns\n• Suggest study sessions and skill missions\n• Give you productivity insights\n\nJust tell me what's going on — naturally, like you'd tell a friend.",
      actions: [],
      provider: "local",
    };
  }

  const detectedTasks = detectTasks(userText);
  const date = detectDate(userText);
  const time = detectTime(userText);
  const priority = detectPriority(userText);

  for (const taskTitle of detectedTasks.slice(0, 3)) {
    actions.push({
      type: "create_task",
      label: `Create task: "${taskTitle}"`,
      data: {
        title: taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1),
        priority,
        dueDate: date,
        dueTime: time,
      },
    });
  }

  const meetingMatch = userText.match(
    /(?:meeting|call|session|event|appointment)\s+(?:about\s+)?(.+?)(?:\s+at|\s+on|\s+by|$)/i
  );
  if (meetingMatch && (date || time)) {
    actions.push({
      type: "create_event",
      label: `Add to calendar: "${meetingMatch[1].trim()}"`,
      data: {
        title: meetingMatch[1].trim(),
        date: date ?? new Date().toISOString().split("T")[0],
        startTime: time,
        type: "meeting",
      },
    });
  }

  const stressWords = ["stressed", "anxious", "overwhelmed", "worried", "exhausted", "burned out"];
  const hasStress = stressWords.some((w) => lower.includes(w));

  let reply = "";

  if (actions.length > 0 && detectedTasks.length > 0) {
    reply = `I caught ${detectedTasks.length} thing${detectedTasks.length > 1 ? "s" : ""} you need to handle`;
    if (date) reply += ` — looks like ${date === new Date().toISOString().split("T")[0] ? "today" : "upcoming"}`;
    if (time) reply += ` at ${time}`;
    reply += `. I've prepared ${actions.length} action${actions.length > 1 ? "s" : ""} for you below.`;
    if (priority === "high" || priority === "critical")
      reply += " These look high priority — I'd tackle them first.";
  } else if (hasStress) {
    reply =
      "I'm picking up some stress in what you wrote. Remember: break big problems into small steps. Can I help you turn any of this into clear tasks so it feels less overwhelming?";
    actions.push({
      type: "journal_insight",
      label: "Log this as a journal entry",
      data: { content: userText, mood: "bad" },
    });
  } else if (lower.includes("schedule") || lower.includes("plan")) {
    reply =
      "Want me to help you build a schedule? Tell me what you need to get done and by when — I'll create time blocks for you.";
  } else if (lower.includes("learn") || lower.includes("study") || lower.includes("skill")) {
    reply =
      "Great mindset! Head to the Skills section and I'll generate a personalized mission and class plan for any skill you want to track. What are you trying to learn?";
  } else {
    reply =
      "Got it. Tell me more — are there any tasks, deadlines, or events I should help you track? I work best when you describe what you're working on naturally.";
  }

  return { reply, actions, provider: "local" };
}

// ─── Main: API → fallback chain ───────────────────────────────────────────────

export async function callThoughts(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ThoughtsResponse> {
  try {
    const res = await fetch("/api/thoughts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, history }),
    });

    // API reached but all cloud providers failed → use local engine
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      if (body?.error === "all_providers_failed") {
        return ruleBased(userMessage);
      }
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return data as ThoughtsResponse;
  } catch {
    // Network error or server down → use local engine
    return ruleBased(userMessage);
  }
}
