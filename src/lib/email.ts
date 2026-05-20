import { Resend } from "resend";

// Lazily initialised — avoids "Missing API key" crash during Next.js build
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM    = "ThoughtStack <onboarding@resend.dev>";
const APP_URL = process.env.NEXTAUTH_URL ?? "https://thoughtstack-ten.vercel.app";

// ─── Notify admin of a new signup ────────────────────────────────────────────
export async function sendNewSignupNotification(user: { name: string; email: string }) {
  const resend     = getResend();
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  if (!resend || !adminEmail) return;

  await resend.emails.send({
    from: FROM,
    to:   adminEmail,
    subject: `🔔 New signup request: ${user.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="margin-bottom:8px">New signup on ThoughtStack</h2>
        <p style="color:#666;margin-top:0">Someone just requested access to your workspace.</p>
        <table style="border-collapse:collapse;width:100%;margin:24px 0">
          <tr><td style="padding:8px 0;color:#999;width:120px">Name</td><td><strong>${user.name}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#999">Email</td><td>${user.email}</td></tr>
          <tr><td style="padding:8px 0;color:#999">Requested</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <a href="${APP_URL}/admin"
           style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Review in Admin Panel →
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">ThoughtStack · Private Workspace</p>
      </div>
    `,
  });
}

// ─── Notify user that they have been approved ─────────────────────────────────
export async function sendApprovalEmail(user: { name: string; email: string }) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to:   user.email,
    subject: "✅ You've been approved — welcome to ThoughtStack!",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="margin-bottom:8px">You're in, ${user.name.split(" ")[0]}! 🎉</h2>
        <p style="color:#666;margin-top:0">
          Your ThoughtStack account has been approved. You can now sign in and start using your workspace.
        </p>
        <a href="${APP_URL}/auth"
           style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Sign in to ThoughtStack →
        </a>
        <p style="color:#666;font-size:14px">
          Manage tasks, journal, track skills, and get smart insights from the Thoughts AI assistant.
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">ThoughtStack · Private Workspace</p>
      </div>
    `,
  });
}

// ─── Notify user that they have been rejected ─────────────────────────────────
export async function sendRejectionEmail(user: { name: string; email: string }) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to:   user.email,
    subject: "ThoughtStack — Access request update",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="margin-bottom:8px">Update on your request</h2>
        <p style="color:#666;margin-top:0">
          Hi ${user.name.split(" ")[0]}, unfortunately your access request to ThoughtStack was not approved at this time.
        </p>
        <p style="color:#666;font-size:14px">If you believe this is a mistake, contact the workspace admin directly.</p>
        <p style="color:#999;font-size:12px;margin-top:24px">ThoughtStack · Private Workspace</p>
      </div>
    `,
  });
}
