import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

interface WebPushError {
  statusCode?: number;
  body?: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  const { subscription, title, body, url } = await req.json() as {
    subscription: webpush.PushSubscription;
    title:        string;
    body?:        string;
    url?:         string;
  };

  if (!subscription || !title) {
    return NextResponse.json({ error: "Missing subscription or title" }, { status: 400 });
  }

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subjectRaw = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subjectRaw) {
    return NextResponse.json(
      { error: "vapid_not_configured", detail: "Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT on Vercel" },
      { status: 500 },
    );
  }

  // VAPID subject must be either "mailto:..." or an "https://..." URL.
  // Auto-prefix bare emails so the env var is forgiving.
  const subject = /^(mailto:|https?:)/.test(subjectRaw)
    ? subjectRaw
    : `mailto:${subjectRaw}`;

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    console.error("[Push] Invalid VAPID config:", err);
    return NextResponse.json(
      { error: "invalid_vapid", detail: (err as Error).message },
      { status: 500 },
    );
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body: body ?? "", url: url ?? "/" }),
      { TTL: 60 * 60 * 24 }, // delivered within 24h or dropped
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const wpErr = err as WebPushError;
    const status = wpErr.statusCode;

    // 404 / 410: subscription is expired or unregistered. The client should
    // delete its cached subscription and ask the user to re-enable.
    if (status === 404 || status === 410) {
      return NextResponse.json(
        { error: "subscription_expired", statusCode: status },
        { status: 410 },
      );
    }

    // 413 / 429: payload too big or rate-limited — caller can retry
    if (status === 413 || status === 429) {
      return NextResponse.json(
        { error: "rate_limited_or_too_large", statusCode: status },
        { status: status },
      );
    }

    console.error("[Push] Send failed:", { status, body: wpErr.body, message: wpErr.message });
    return NextResponse.json(
      { error: "send_failed", statusCode: status, detail: wpErr.message },
      { status: 500 },
    );
  }
}
