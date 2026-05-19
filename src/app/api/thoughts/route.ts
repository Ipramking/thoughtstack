import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Clients ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// ─── Shared system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Thoughts — the intelligent AI assistant inside ThoughtStack, a personal operating system app.

Your personality: warm, concise, proactive, and smart. You speak like a knowledgeable friend, not a formal assistant.

Your capabilities:
- Parse natural language to detect tasks, dates, times, priorities
- Analyze journal entries for emotional patterns and productivity insights
- Suggest scheduling, time blocks, and task priorities
- Generate learning paths and study recommendations
- Connect related notes, tasks, and entries

When detecting actionable items, ALWAYS return structured JSON in this exact format at the end of your reply:

ACTIONS_JSON:[{"type":"create_task","label":"Create task: X","data":{"title":"...","priority":"medium","dueDate":"YYYY-MM-DD","dueTime":"HH:mm"}},{"type":"create_event","label":"Add to calendar: X","data":{"title":"...","date":"YYYY-MM-DD","startTime":"HH:mm","type":"meeting"}}]

Rules:
- Keep replies under 150 words
- Be specific and actionable, never vague
- If no actions are detected, omit ACTIONS_JSON entirely
- Today's date: ${new Date().toISOString().split("T")[0]}
- Priority levels: low, medium, high, critical
- Event types: task, meeting, reminder, personal, study`;

// ─── Helper: parse ACTIONS_JSON from raw text ─────────────────────────────────
function parseResponse(rawText: string): { reply: string; actions: unknown[] } {
  const actionsMatch = rawText.match(/ACTIONS_JSON:(\[[\s\S]*?\])/);
  let actions: unknown[] = [];
  let reply = rawText;
  if (actionsMatch) {
    try { actions = JSON.parse(actionsMatch[1]); } catch { /* ignore */ }
    reply = rawText.replace(/ACTIONS_JSON:\[[\s\S]*?\]/, "").trim();
  }
  return { reply, actions };
}

// ─── Provider 1: Claude ───────────────────────────────────────────────────────
async function tryClause(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ reply: string; actions: unknown[]; provider: string }> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages,
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";
  return { ...parseResponse(rawText), provider: "claude" };
}

// ─── Provider 2: Gemini ───────────────────────────────────────────────────────
async function tryGemini(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ reply: string; actions: unknown[]; provider: string }> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  // Build Gemini history format
  const geminiHistory = history.map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(message);
  const rawText = result.response.text();
  return { ...parseResponse(rawText), provider: "gemini" };
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { message, history } = await req.json();

  // 1️⃣  Try Claude
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await tryClause(message, history);
      return NextResponse.json(result);
    } catch (err) {
      console.warn("[Thoughts] Claude failed, falling back to Gemini:", err);
    }
  }

  // 2️⃣  Try Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await tryGemini(message, history);
      return NextResponse.json(result);
    } catch (err) {
      console.warn("[Thoughts] Gemini failed, falling back to rule-based:", err);
    }
  }

  // 3️⃣  Signal client to use rule-based fallback
  return NextResponse.json({ error: "all_providers_failed" }, { status: 503 });
}
