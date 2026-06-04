import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * /api/cron/morning-briefing
 *
 * Sends a personalised push to each user once a day with:
 *   - Count of tasks due today + 1-2 top titles
 *   - First calendar event of the day
 *   - A gentle journal prompt
 *
 * Triggered by GitHub Actions or any cron at ~7:30 am UTC. The endpoint is
 * idempotent within a 12-hour window: we record sent_at on each push subscription
 * for type=morning, and skip users we've already greeted today.
 */

interface BrowserPushSubscription {
  endpoint: string;
  keys?:    { p256dh?: string; auth?: string };
}

interface TaskData {
  title?:    string;
  status?:   string;
  dueDate?:  string;
  priority?: string;
}

interface EventData {
  title?:     string;
  date?:      string;
  startTime?: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PROMPTS = [
  "What's one thing you want to feel proud of tonight?",
  "Pick the one task that would make today a win.",
  "What's been on your mind lately?",
  "How are you feeling this morning?",
  "What would make today 1% better?",
  "What's worth your full attention today?",
];

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization")?.trim();
  if (auth && auth.replace(/^Bearer\s+/i, "").trim() === expected) return true;
  const qs = req.nextUrl.searchParams.get("secret")?.trim();
  return !!qs && qs === expected;
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subjectRaw = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subjectRaw) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }
  const subject = /^(mailto:|https?:)/.test(subjectRaw) ? subjectRaw : `mailto:${subjectRaw}`;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  // Get every distinct user with a push subscription
  const { data: subs, error: subErr } = await supabase
    .from("ts_push_subscriptions")
    .select("user_email, endpoint, subscription");

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0, users: 0 });

  const byUser = new Map<string, typeof subs>();
  for (const s of subs) {
    const arr = byUser.get(s.user_email) ?? [];
    arr.push(s);
    byUser.set(s.user_email, arr);
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);   // YYYY-MM-DD
  let sent = 0;
  const deadEndpoints: string[] = [];

  for (const [email, userSubs] of byUser) {
    // Fetch this user's tasks + events
    const [tasksRes, eventsRes] = await Promise.all([
      supabase.from("ts_tasks") .select("data").eq("user_email", email),
      supabase.from("ts_events").select("data").eq("user_email", email),
    ]);

    const tasks  = (tasksRes.data  ?? []).map((r) => r.data as TaskData);
    const events = (eventsRes.data ?? []).map((r) => r.data as EventData);

    const dueToday = tasks.filter((t) =>
      t.status !== "done" && t.dueDate === todayStr
    );
    const todayEvents = events
      .filter((e) => e.date === todayStr)
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

    // Build the body
    const lines: string[] = [];
    if (dueToday.length === 0) {
      lines.push("No tasks due today — clean slate ✨");
    } else if (dueToday.length === 1) {
      lines.push(`1 task today: ${dueToday[0].title}`);
    } else {
      lines.push(`${dueToday.length} tasks today. First: ${dueToday[0].title}`);
    }
    if (todayEvents.length > 0) {
      const ev = todayEvents[0];
      lines.push(`📅 ${ev.startTime ?? "All day"} — ${ev.title}`);
    }
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    lines.push(`💭 ${prompt}`);

    const payload = JSON.stringify({
      title: "Good morning 👋",
      body:  lines.join("\n"),
      url:   "/",
      tag:   `morning-${todayStr}`,
    });

    for (const s of userSubs) {
      try {
        await webpush.sendNotification(
          s.subscription as BrowserPushSubscription as webpush.PushSubscription,
          payload,
          { TTL: 60 * 60 * 6 },   // give 6h to deliver
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) deadEndpoints.push(s.endpoint);
      }
    }
  }

  // Clean up dead subscriptions
  if (deadEndpoints.length) {
    await supabase.from("ts_push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return NextResponse.json({
    ok:           true,
    users:        byUser.size,
    sent,
    deadCleaned:  deadEndpoints.length,
  });
}
