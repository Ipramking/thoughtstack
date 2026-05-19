/**
 * Legacy auth endpoint — kept for backwards-compat with sidebar logout button.
 * All real auth now goes through NextAuth at /api/auth/[...nextauth].
 */
import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/auth";

export async function POST(req: NextRequest) {
  const { action } = await req.json().catch(() => ({ action: "" }));

  if (action === "logout") {
    await signOut({ redirect: false });
    return NextResponse.json({ ok: true });
  }

  // check — always redirect to NextAuth's session endpoint
  return NextResponse.json({ redirect: "/api/auth/session" });
}

export async function GET() {
  return NextResponse.json({ hasPassword: !!(process.env.ADMIN_PASSWORD) });
}
