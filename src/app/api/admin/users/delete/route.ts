import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await req.json();
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
