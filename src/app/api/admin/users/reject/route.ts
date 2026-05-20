import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rejectUser } from "@/lib/db";
import { sendRejectionEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, name, email } = await req.json();
  const user = await rejectUser(id, session.user.email ?? "admin");
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  sendRejectionEmail({ name, email }).catch(console.error);
  return NextResponse.json({ ok: true, user });
}
