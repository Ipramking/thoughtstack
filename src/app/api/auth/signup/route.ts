import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail, initDb } from "@/lib/db";
import { sendNewSignupNotification } from "@/lib/email";

let dbReady = false;

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const emailClean = email.toLowerCase().trim();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(emailClean)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!dbReady) { await initDb(); dbReady = true; }

    // Duplicate check
    const existing = await findUserByEmail(emailClean);
    if (existing) {
      if (existing.status === "pending") {
        return NextResponse.json(
          { error: "This email already has a pending request. Please wait for approval." },
          { status: 409 }
        );
      }
      if (existing.status === "approved") {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }
      if (existing.status === "rejected") {
        return NextResponse.json(
          { error: "Your previous request was not approved. Please contact the admin." },
          { status: 409 }
        );
      }
    }

    const hash = await bcrypt.hash(password, 12);
    await createUser(name.trim(), emailClean, hash);

    // Notify admin (fire-and-forget — don't block the response)
    sendNewSignupNotification({ name: name.trim(), email: emailClean }).catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
