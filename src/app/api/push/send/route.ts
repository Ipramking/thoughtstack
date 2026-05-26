import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export async function POST(req: NextRequest) {
  const { subscription, title, body, url } = await req.json() as {
    subscription: webpush.PushSubscription;
    title: string;
    body?: string;
    url?: string;
  };

  if (!subscription || !title) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  // Trim any whitespace/BOM that env vars might carry
  webpush.setVapidDetails(subject.trim(), publicKey.trim(), privateKey.trim());

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body: body ?? "", url: url ?? "/" }),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Push] Send failed:", err);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
