import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? "mailto:admin@thoughtstack.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? "",
);

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
