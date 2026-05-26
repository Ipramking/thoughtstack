import { NextRequest, NextResponse } from "next/server";

/**
 * Store a push subscription.
 * For now we just echo it back — the client stores it in Zustand.
 * In a multi-device setup, persist to Supabase here.
 */
export async function POST(req: NextRequest) {
  const { subscription } = await req.json() as { subscription: unknown };
  if (!subscription) {
    return NextResponse.json({ error: "No subscription" }, { status: 400 });
  }
  // TODO (multi-device): save to Supabase `push_subscriptions` table linked to user
  return NextResponse.json({ ok: true });
}
