import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { changeUserPassword } from "@/lib/db";

/**
 * POST /api/account/password
 * Body: { currentPassword: string, newPassword: string }
 * Auth: requires NextAuth session.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json() as {
    currentPassword?: string;
    newPassword?:     string;
  };

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both currentPassword and newPassword are required" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "New password must be different from current" }, { status: 400 });
  }

  try {
    const ok = await changeUserPassword(session.user.email, currentPassword, newPassword);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/password]", err);
    return NextResponse.json({ error: "Could not update password" }, { status: 500 });
  }
}
