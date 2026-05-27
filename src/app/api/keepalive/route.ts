import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/keepalive
 *
 * Called daily by Vercel Cron (see vercel.json).
 * Runs a lightweight query so Supabase never hits the 7-day
 * inactivity threshold that triggers free-tier pausing.
 *
 * Secured by the CRON_SECRET env var — Vercel injects this
 * automatically as the Authorization header on every cron call.
 */
export async function GET(req: NextRequest) {
  // Verify this is being called by Vercel's cron system
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Lightest possible query — just count rows in ts_users
    const { count, error } = await supabase
      .from("ts_users")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({
      ok:        true,
      ping:      "supabase alive",
      userCount: count ?? 0,
      ts:        new Date().toISOString(),
    });
  } catch (err) {
    console.error("[keepalive] Supabase ping failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
