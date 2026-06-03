import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface BrowserPushSubscription {
  endpoint: string;
  keys?:    { p256dh?: string; auth?: string };
}

/**
 * POST — upsert this device's push subscription so the cron can send to it later.
 * Upserts by endpoint (unique per device + permission grant).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subscription } = await req.json() as { subscription: BrowserPushSubscription };
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ts_push_subscriptions")
    .upsert(
      {
        user_email:   session.user.email,
        endpoint:     subscription.endpoint,
        subscription: subscription,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    console.error("[Push subscribe]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE — remove this device's push subscription (user disabled notifications).
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint } = await req.json() as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ts_push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_email", session.user.email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
