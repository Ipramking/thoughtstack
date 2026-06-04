/**
 * parse-task-input.ts
 *
 * Extracts date, time, priority, and recurrence from natural-language task
 * titles so users can type "pay rent on the 5th at 9am !urgent" and have
 * the dialog auto-fill.
 *
 * Pure function — no React, no DOM, no API calls. Reusable from anywhere.
 */

import { format, addDays, addWeeks, addMonths, startOfMonth, setDate, isValid } from "date-fns";

export type Priority   = "low" | "medium" | "high" | "critical";
export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface ParsedTask {
  title:      string;       // input with the matched tokens stripped
  dueDate?:   string;       // yyyy-MM-dd
  dueTime?:   string;       // HH:mm (24h)
  priority?:  Priority;
  recurrence?: Recurrence;
  tags?:      string[];     // lowercase tags from #hashtags
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

const ORDINAL_RE = /(\d{1,2})(st|nd|rd|th)?/i;

function nextWeekday(from: Date, weekday: number): Date {
  const cur  = from.getDay();
  let delta  = (weekday - cur + 7) % 7;
  if (delta === 0) delta = 7;       // "next Monday" means a week from now if today is Monday
  return addDays(from, delta);
}

// Strip a matched substring from the title and tidy whitespace
function strip(input: string, match: RegExpMatchArray): string {
  if (match.index === undefined) return input;
  return (input.slice(0, match.index) + input.slice(match.index + match[0].length))
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Time parsing: "at 9am", "by 14:30", "9pm", "noon", "midnight" ────────────
function tryParseTime(input: string): { time: string; remaining: string } | null {
  const lower = input;

  // Word forms
  const noon = /\b(noon|midday)\b/i.exec(lower);
  if (noon) return { time: "12:00", remaining: strip(input, noon) };
  const mid = /\b(midnight)\b/i.exec(lower);
  if (mid) return { time: "00:00", remaining: strip(input, mid) };

  // "at 9", "at 9am", "at 9:30 pm", "by 14:00", "9pm"
  const re = /\b(?:at|by|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/i;
  const m = re.exec(lower);
  if (!m) return null;

  let hr = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.replace(/\./g, "").toLowerCase();

  // Disambiguate "5" — only treat as time if there's am/pm OR explicit "at/by/:"
  const hasContext = !!ampm || /[:@]/.test(m[0]) || /\b(at|by)\b/i.test(m[0]);
  if (!hasContext) return null;

  if (hr < 0 || hr > 23) return null;
  if (min < 0 || min > 59) return null;

  if (ampm === "pm" && hr < 12) hr += 12;
  if (ampm === "am" && hr === 12) hr = 0;

  return {
    time:      `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
    remaining: strip(input, m),
  };
}

// ── Date parsing ─────────────────────────────────────────────────────────────
function tryParseDate(input: string, baseDate = new Date()): { date: string; remaining: string } | null {
  // "today", "tomorrow"
  const today = /\btoday\b/i.exec(input);
  if (today) return { date: format(baseDate, "yyyy-MM-dd"), remaining: strip(input, today) };

  const tom = /\btomorrow\b/i.exec(input);
  if (tom) return { date: format(addDays(baseDate, 1), "yyyy-MM-dd"), remaining: strip(input, tom) };

  // "in N days/weeks/months"
  const rel = /\bin\s+(\d+)\s+(day|week|month)s?\b/i.exec(input);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const u = rel[2].toLowerCase();
    const d = u === "day"   ? addDays(baseDate, n)
            : u === "week"  ? addWeeks(baseDate, n)
            :                  addMonths(baseDate, n);
    return { date: format(d, "yyyy-MM-dd"), remaining: strip(input, rel) };
  }

  // "next monday", "this friday"
  const wkRe = /\b(next|this)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i;
  const wk = wkRe.exec(input);
  if (wk) {
    const dow = WEEKDAY_MAP[wk[2].toLowerCase()];
    const d   = nextWeekday(baseDate, dow);
    return { date: format(d, "yyyy-MM-dd"), remaining: strip(input, wk) };
  }

  // "on the 5th", "on the 15th"
  const ord = /\bon\s+the\s+(\d{1,2})(st|nd|rd|th)?\b/i.exec(input);
  if (ord) {
    const day = parseInt(ord[1], 10);
    if (day >= 1 && day <= 31) {
      // Pick the next occurrence — this month if still in the future, else next month
      const thisMonth = setDate(startOfMonth(baseDate), day);
      const target = thisMonth.getTime() > baseDate.getTime() ? thisMonth : setDate(startOfMonth(addMonths(baseDate, 1)), day);
      if (isValid(target)) return { date: format(target, "yyyy-MM-dd"), remaining: strip(input, ord) };
    }
  }

  // ISO-ish: "2025-12-25" or "12/25" or "12-25"
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(input);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`);
    if (isValid(d)) return { date: format(d, "yyyy-MM-dd"), remaining: strip(input, iso) };
  }

  return null;
}

// ── Priority: "!urgent", "!high", "!critical", "!low" ────────────────────────
function tryParsePriority(input: string): { priority: Priority; remaining: string } | null {
  const re = /(?:^|\s)!(urgent|critical|high|medium|low)\b/i;
  const m = re.exec(input);
  if (!m) return null;
  const map: Record<string, Priority> = {
    urgent: "critical", critical: "critical", high: "high", medium: "medium", low: "low",
  };
  return { priority: map[m[1].toLowerCase()], remaining: strip(input, m) };
}

// ── Recurrence: "daily", "weekly", "every monday", "every weekday" ───────────
function tryParseRecurrence(input: string): { recurrence: Recurrence; remaining: string } | null {
  // "every day" / "daily"
  const daily = /\b(every\s+day|daily)\b/i.exec(input);
  if (daily) return { recurrence: "daily", remaining: strip(input, daily) };

  // "every weekday"
  const wkday = /\b(every\s+weekday|weekdays)\b/i.exec(input);
  if (wkday) return { recurrence: "weekdays", remaining: strip(input, wkday) };

  // "every week" / "weekly" / "every monday"
  const weekly = /\b(every\s+week|weekly|every\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/i.exec(input);
  if (weekly) return { recurrence: "weekly", remaining: strip(input, weekly) };

  // "every month" / "monthly"
  const monthly = /\b(every\s+month|monthly)\b/i.exec(input);
  if (monthly) return { recurrence: "monthly", remaining: strip(input, monthly) };

  return null;
}

// ── Tag extraction: #work #errand ─────────────────────────────────────────────
function extractTags(input: string): { tags: string[]; remaining: string } {
  const tags: string[] = [];
  const remaining = input.replace(/(?:^|\s)#([a-zA-Z0-9_-]{2,30})/g, (_, tag) => {
    tags.push(tag.toLowerCase());
    return " ";
  });
  return { tags, remaining: remaining.replace(/\s{2,}/g, " ").trim() };
}

// ── Main entry point ─────────────────────────────────────────────────────────
export function parseTaskInput(rawInput: string, baseDate = new Date()): ParsedTask {
  let remaining = rawInput;
  const result: ParsedTask = { title: rawInput };

  // Tags first — '#' is a distinctive sigil that won't collide with anything else
  const tagRes = extractTags(remaining);
  if (tagRes.tags.length > 0) { result.tags = tagRes.tags; remaining = tagRes.remaining; }

  // Then priority + recurrence (most distinctive forms),
  // then time (often has the "at" word), then date.
  const prio = tryParsePriority(remaining);
  if (prio) { result.priority = prio.priority; remaining = prio.remaining; }

  const rec = tryParseRecurrence(remaining);
  if (rec) { result.recurrence = rec.recurrence; remaining = rec.remaining; }

  const time = tryParseTime(remaining);
  if (time) { result.dueTime = time.time; remaining = time.remaining; }

  const date = tryParseDate(remaining, baseDate);
  if (date) { result.dueDate = date.date; remaining = date.remaining; }

  result.title = remaining.replace(/\s+,\s*$/, "").trim();
  return result;
}
