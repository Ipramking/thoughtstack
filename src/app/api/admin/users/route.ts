import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPendingUsers } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await listPendingUsers();
  return NextResponse.json({ users });
}
