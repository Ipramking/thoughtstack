import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { ThoughtsContext } from "@/types";

// ── Clients ───────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI     = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// ── Rate limit ────────────────────────────────────────────────────────────────
// Per-instance sliding window (resets on cold start — good enough to stop a
// runaway client or a stolen session from burning through API credits).
const RATE_LIMIT = 20;                 // requests
const RATE_WINDOW_MS = 5 * 60 * 1000;  // per 5 minutes
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const baseSystem = () => `You are Thoughts — the intelligent AI assistant inside ThoughtStack, a personal operating system app.

Your personality: warm, concise, proactive, and smart. You speak like a knowledgeable friend, not a formal assistant.

Your capabilities:
- Parse natural language to detect tasks, dates, times, priorities
- Analyse journal entries for emotional patterns and productivity insights
- Suggest scheduling, time blocks, and task priorities
- Generate learning paths and study recommendations
- Answer questions about the user's data (tasks, events, habits)

When detecting actionable items, return structured JSON at the END of your reply ONLY:

ACTIONS_JSON:[{"type":"create_task","label":"Create task: X","data":{"title":"...","priority":"medium","dueDate":"YYYY-MM-DD","dueTime":"HH:mm"}},{"type":"create_event","label":"Add to calendar: X","data":{"title":"...","date":"YYYY-MM-DD","startTime":"HH:mm","type":"meeting"}}]

Rules:
- Keep replies under 180 words
- Be specific and actionable — use the user's actual data when answering
- If no actions are detected, omit ACTIONS_JSON entirely
- Today's date: ${new Date().toISOString().split("T")[0]}
- Priority levels: low, medium, high, critical
- Event types: task, meeting, reminder, personal, study`;

function buildSystemPrompt(context?: ThoughtsContext): string {
  // Rebuilt per request — a module-level constant would freeze "Today's date"
  // on warm serverless instances.
  const base = baseSystem();
  if (!context) return base;

  const parts: string[] = [base, "\n\n── USER CONTEXT (use this to give personalised answers) ──"];

  if (context.todayTasks.length > 0) {
    const taskLines = context.todayTasks
      .map((t) => `  • [${t.status}] ${t.title} (${t.priority}${t.dueTime ? ` @ ${t.dueTime}` : ""})`)
      .join("\n");
    parts.push(`Today's tasks:\n${taskLines}`);
  } else {
    parts.push("Today's tasks: none due today");
  }

  if (context.todayEvents.length > 0) {
    const evLines = context.todayEvents
      .map((e) => `  • ${e.title}${e.startTime ? ` @ ${e.startTime}` : ""} (${e.type})`)
      .join("\n");
    parts.push(`Today's events:\n${evLines}`);
  }

  if (context.recentJournals.length > 0) {
    const jLines = context.recentJournals
      .map((j) => `  • "${j.title}" — mood: ${j.mood ?? "not set"} (${j.date})`)
      .join("\n");
    parts.push(`Recent journal entries:\n${jLines}`);
  }

  parts.push(
    `Stats: ${context.stats.tasksDone}/${context.stats.tasksTotal} tasks done · ${context.stats.journalCount} journal entries · ${context.stats.streak} day streak`
  );

  return parts.join("\n");
}

// ── Parse ACTIONS_JSON ────────────────────────────────────────────────────────
function parseResponse(rawText: string): { reply: string; actions: unknown[] } {
  const m = rawText.match(/ACTIONS_JSON:(\[[\s\S]*?\])/);
  let actions: unknown[] = [];
  let reply = rawText;
  if (m) {
    try { actions = JSON.parse(m[1]); } catch { /* ignore */ }
    reply = rawText.replace(/ACTIONS_JSON:\[[\s\S]*?\]/, "").trim();
  }
  return { reply, actions };
}

// ── Provider 1: Claude ────────────────────────────────────────────────────────
async function tryClaude(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
) {
  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];
  const res = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 600,
    system: systemPrompt,
    messages,
  });
  const raw = res.content[0].type === "text" ? res.content[0].text : "";
  return { ...parseResponse(raw), provider: "claude" };
}

// ── Provider 2: Gemini ────────────────────────────────────────────────────────
async function tryGemini(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });
  const geminiHistory = history.map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));
  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(message);
  const raw = result.response.text();
  return { ...parseResponse(raw), provider: "gemini" };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (rateLimited(session.user.email)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { message, history, context } = await req.json() as {
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    context?: ThoughtsContext;
  };

  const systemPrompt = buildSystemPrompt(context);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return NextResponse.json(await tryClaude(message, history, systemPrompt));
    } catch (err) {
      console.warn("[Thoughts] Claude failed →", err);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      return NextResponse.json(await tryGemini(message, history, systemPrompt));
    } catch (err) {
      console.warn("[Thoughts] Gemini failed →", err);
    }
  }

  return NextResponse.json({ error: "all_providers_failed" }, { status: 503 });
}
