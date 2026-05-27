import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** GET /api/sync — pull all user data from Supabase */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;

  const [tasks, journals, events] = await Promise.all([
    supabase.from("ts_tasks")   .select("id, data, updated_at").eq("user_email", email),
    supabase.from("ts_journals").select("id, data, updated_at").eq("user_email", email),
    supabase.from("ts_events")  .select("id, data, updated_at").eq("user_email", email),
  ]);

  return NextResponse.json({
    tasks:    tasks.data    ?? [],
    journals: journals.data ?? [],
    events:   events.data   ?? [],
  });
}

/** POST /api/sync — upsert a batch of items */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;
  const { type, items } = await req.json() as {
    type: "tasks" | "journals" | "events";
    items: Array<{ id: string; data: object; updated_at: string }>;
  };

  const table = type === "tasks" ? "ts_tasks" : type === "journals" ? "ts_journals" : "ts_events";
  const rows = items.map((item) => ({ ...item, user_email: email }));

  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, synced: items.length });
}

/** DELETE /api/sync — delete an item from Supabase */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;
  const { type, id } = await req.json() as { type: "tasks" | "journals" | "events"; id: string };

  const table = type === "tasks" ? "ts_tasks" : type === "journals" ? "ts_journals" : "ts_events";
  await supabase.from(table).delete().eq("id", id).eq("user_email", email);

  return NextResponse.json({ ok: true });
}
