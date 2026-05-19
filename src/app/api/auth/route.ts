import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";

const COOKIE_NAME = "ts-session";
const MAX_AGE     = 60 * 60 * 24 * 30; // 30 days

/**
 * APP_PASSWORD — set this in your Vercel environment variables.
 * Only people who know this password can log in.
 * If not set the app is name-only (open access).
 */
const APP_PASSWORD = process.env.APP_PASSWORD ?? "";
const HAS_PASSWORD = APP_PASSWORD.length > 0;

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = createHash("sha256").update(a).digest();
    const bb = createHash("sha256").update(b).digest();
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({ hasPassword: HAS_PASSWORD });
}

export async function POST(req: NextRequest) {
  const { action, name, password } = await req.json();

  if (action === "login") {
    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (HAS_PASSWORD) {
      if (!password) {
        return NextResponse.json({ error: "Password required" }, { status: 401 });
      }
      if (!safeCompare(password, APP_PASSWORD)) {
        return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
      }
    }

    const payload = Buffer.from(
      JSON.stringify({ name: name.trim(), ts: Date.now() })
    ).toString("base64");

    const res = NextResponse.json({ ok: true, name: name.trim(), hasPassword: HAS_PASSWORD });
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
    if (!cookie) return NextResponse.json({ authenticated: false, hasPassword: HAS_PASSWORD });
    try {
      const data = JSON.parse(Buffer.from(cookie.value, "base64").toString());
      return NextResponse.json({ authenticated: true, name: data.name, hasPassword: HAS_PASSWORD });
    } catch {
      return NextResponse.json({ authenticated: false, hasPassword: HAS_PASSWORD });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
