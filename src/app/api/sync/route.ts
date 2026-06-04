import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SyncType = "tasks" | "journals" | "events";
const TABLE: Record<SyncType, string> = {
  tasks:    "ts_tasks",
  journals: "ts_journals",
  events:   "ts_events",
};

/**
 * GET /api/sync — pull all user data + tombstones from Supabase.
 *
 * Returns:
 *   { tasks, journals, events, tombstones: { tasks: [id...], journals: [...], events: [...] } }
 *
 * The client uses tombstones to delete any local items that were removed
 * on another device. Without this, deletes never stick cross-device.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  const [tasks, journals, events, tombstones] = await Promise.all([
    supabase.from("ts_tasks")     .select("id, data, updated_at").eq("user_email", email),
    supabase.from("ts_journals")  .select("id, data, updated_at").eq("user_email", email),
    supabase.from("ts_events")    .select("id, data, updated_at").eq("user_email", email),
    supabase.from("ts_tombstones").select("id, type")             .eq("user_email", email),
  ]);

  // Group tombstones by type
  const tombByType: Record<SyncType, string[]> = { tasks: [], journals: [], events: [] };
  for (const t of tombstones.data ?? []) {
    const ty = t.type as SyncType;
    if (tombByType[ty]) tombByType[ty].push(t.id);
  }

  return NextResponse.json({
    tasks:      tasks.data    ?? [],
    journals:   journals.data ?? [],
    events:     events.data   ?? [],
    tombstones: tombByType,
  });
}

/**
 * POST /api/sync — upsert a batch of items.
 * Body: { type, items: [{ id, data, updated_at }] }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const { type, items } = await req.json() as {
    type: SyncType;
    items: Array<{ id: string; data: object; updated_at: string }>;
  };

  if (!TABLE[type]) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const rows = items.map((item) => ({ ...item, user_email: email }));
  const { error } = await supabase.from(TABLE[type]).upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, synced: items.length });
}

/**
 * DELETE /api/sync — accepts either { id: string } (legacy) or { ids: string[] }
 * (batch). Records each deletion in ts_tombstones so cross-device pulls can
 * propagate the removal.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const body = await req.json() as { type: SyncType; id?: string; ids?: string[] };
  const ids = body.ids ?? (body.id ? [body.id] : []);

  if (!TABLE[body.type] || ids.length === 0) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // 1. Delete from the actual table
  await supabase.from(TABLE[body.type]).delete().in("id", ids).eq("user_email", email);

  // 2. Insert tombstones so other devices learn about the deletion
  const tombRows = ids.map((id) => ({
    id,
    type:       body.type,
    user_email: email,
    deleted_at: new Date().toISOString(),
  }));
  await supabase.from("ts_tombstones").upsert(tombRows, { onConflict: "id,type,user_email" });

  return NextResponse.json({ ok: true, deleted: ids.length });
}
