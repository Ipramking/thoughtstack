import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ts-session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  const { action, name } = await req.json();

  if (action === "login") {
    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const payload = Buffer.from(
      JSON.stringify({ name: name.trim(), ts: Date.now() })
    ).toString("base64");

    const res = NextResponse.json({ ok: true, name: name.trim() });
    res.cookies.set(COOKIE_NAME, payload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });
    return res;
  }

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return res;
  }

  if (action === "check") {
    const cookie = req.cookies.get(COOKIE_NAME);
    if (!cookie) return NextResponse.json({ authenticated: false });
    try {
      const data = JSON.parse(Buffer.from(cookie.value, "base64").toString());
      return NextResponse.json({ authenticated: true, name: data.name });
    } catch {
      return NextResponse.json({ authenticated: false });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
