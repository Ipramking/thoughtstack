import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * Cron endpoint — scans due reminders and pushes them to every registered
 * device for the owning user.
 *
 * Auth (any of):
 *   - Authorization: Bearer <CRON_SECRET>   (Vercel cron sends this)
 *   - ?secret=<CRON_SECRET>                  (cron-job.org and similar)
 *
 * Triggers:
 *   - Vercel Cron (configured in vercel.json — daily on Hobby, per-minute on Pro)
 *   - For per-minute on Hobby plans, point cron-job.org / cronhub.io at
 *     https://thoughtstack-ten.vercel.app/api/cron/send-reminders?secret=...
 */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface WebPushError {
  statusCode?: number;
  body?:       string;
  message?:    string;
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const auth = req.headers.get("authorization")?.trim();
  if (auth && auth.replace(/^Bearer\s+/i, "").trim() === expected) return true;

  const qs = req.nextUrl.searchParams.get("secret")?.trim();
  if (qs && qs === expected) return true;

  return false;
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subjectRaw = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subjectRaw) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  }

  const subject = /^(mailto:|https?:)/.test(subjectRaw)
    ? subjectRaw
    : `mailto:${subjectRaw}`;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  // 1. Find all reminders that are due and not yet sent
  const { data: due, error: dueErr } = await supabase
    .from("ts_reminders")
    .select("id, user_email, title, body, url")
    .is("sent_at", null)
    .lte("due_at", new Date().toISOString())
    .limit(200);

  if (dueErr) {
    console.error("[cron] fetch due failed:", dueErr);
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  if (!due || due.length === 0) {
    // Nothing to send — also do a small cleanup
    await supabase
      .from("ts_reminders")
      .delete()
      .not("sent_at", "is", null)
      .lt("sent_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    return NextResponse.json({ ok: true, sent: 0, due: 0 });
  }

  // 2. Group reminders by user so we fetch each user's subscriptions once
  const byUser = new Map<string, typeof due>();
  for (const r of due) {
    const arr = byUser.get(r.user_email) ?? [];
    arr.push(r);
    byUser.set(r.user_email, arr);
  }

  let totalSent = 0;
  const sentIds: string[] = [];
  const deadEndpoints: string[] = [];

  for (const [email, reminders] of byUser) {
    const { data: subs, error: subErr } = await supabase
      .from("ts_push_subscriptions")
      .select("endpoint, subscription")
      .eq("user_email", email);

    if (subErr) {
      console.error(`[cron] subs fetch failed for ${email}:`, subErr);
      continue;
    }
    if (!subs || subs.length === 0) {
      // No subscriptions — mark sent so we don't keep retrying forever
      sentIds.push(...reminders.map((r) => r.id));
      continue;
    }

    for (const reminder of reminders) {
      const payload = JSON.stringify({
        title: reminder.title,
        body:  reminder.body ?? "",
        url:   reminder.url ?? "/tasks",
        tag:   reminder.id,   // browser dedupes by tag — replaces any local notification
      });

      // Send to every device for this user
      let anySuccess = false;
      for (const s of subs) {
        try {
          await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload, {
            TTL: 60 * 60 * 24,   // give it a day to deliver if device is offline
          });
          anySuccess = true;
          totalSent++;
        } catch (err) {
          const wpErr = err as WebPushError;
          // Subscription is gone — schedule it for deletion
          if (wpErr.statusCode === 404 || wpErr.statusCode === 410) {
            deadEndpoints.push(s.endpoint);
          } else {
            console.error(`[cron] send failed for ${email}:`, wpErr.statusCode, wpErr.message);
          }
        }
      }

      // Mark the reminder as sent even if it failed — we don't want to spam retries.
      // (A failed reminder once is better than 1440 failed reminders a day.)
      if (anySuccess || subs.length === 0) sentIds.push(reminder.id);
    }
  }

  // 3. Mark reminders as sent
  if (sentIds.length) {
    await supabase
      .from("ts_reminders")
      .update({ sent_at: new Date().toISOString() })
      .in("id", sentIds);
  }

  // 4. Remove dead subscriptions
  if (deadEndpoints.length) {
    await supabase
      .from("ts_push_subscriptions")
      .delete()
      .in("endpoint", deadEndpoints);
  }

  return NextResponse.json({
    ok:           true,
    due:          due.length,
    sent:         totalSent,
    deadCleaned:  deadEndpoints.length,
  });
}
