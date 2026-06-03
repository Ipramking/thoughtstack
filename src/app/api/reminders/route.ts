import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST — schedule (or re-schedule) a reminder. id MUST equal the task id so
 * that updating a task's due time replaces the existing reminder, and so the
 * SW-local notification + the server-push notification dedupe via the same tag.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, title, body, url, dueAt } = await req.json() as {
    id:     string;
    title:  string;
    body?:  string;
    url?:   string;
    dueAt:  number | string;   // ms epoch or ISO
  };

  if (!id || !title || !dueAt) {
    return NextResponse.json({ error: "Missing id/title/dueAt" }, { status: 400 });
  }

  const dueIso = typeof dueAt === "number"
    ? new Date(dueAt).toISOString()
    : new Date(dueAt).toISOString();

  // Skip past-due reminders — nothing to deliver
  if (new Date(dueIso).getTime() <= Date.now()) {
    return NextResponse.json({ ok: true, skipped: "already past due" });
  }

  const { error } = await supabase
    .from("ts_reminders")
    .upsert(
      {
        id,
        user_email: session.user.email,
        title,
        body:       body ?? "Your task is due now!",
        url:        url ?? "/tasks",
        due_at:     dueIso,
        sent_at:    null,    // reset if re-scheduling
      },
      { onConflict: "id" },
    );

  if (error) {
    console.error("[Reminders POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE — cancel a reminder (task completed / deleted / due time changed).
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("ts_reminders")
    .delete()
    .eq("id", id)
    .eq("user_email", session.user.email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
