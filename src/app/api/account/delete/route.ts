import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteSelfAccount } from "@/lib/db";

/**
 * POST /api/account/delete
 * Body: { password: string, confirmText: string }   (confirmText must equal "DELETE")
 * Auth: requires NextAuth session.
 *
 * Permanently wipes the user from ts_users and removes every row they own
 * across ts_tasks / ts_journals / ts_events / ts_push_subscriptions /
 * ts_reminders / ts_tombstones.
 *
 * NextAuth session JWT will continue to exist client-side until next refresh,
 * but every subsequent server check will 401 because the user row is gone.
 * Client must also call signOut() after this returns.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password, confirmText } = await req.json() as {
    password?:    string;
    confirmText?: string;
  };

  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }
  if (confirmText !== "DELETE") {
    return NextResponse.json({ error: "You must type DELETE to confirm" }, { status: 400 });
  }

  try {
    const ok = await deleteSelfAccount(session.user.email, password);
    if (!ok) return NextResponse.json({ error: "Password is incorrect" }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "admin_cannot_self_delete") {
      return NextResponse.json(
        { error: "Admin accounts can't be deleted from here. Contact another admin." },
        { status: 403 },
      );
    }
    console.error("[account/delete]", err);
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }
}
