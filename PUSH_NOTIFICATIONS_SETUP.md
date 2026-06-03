# Server-side push notifications — setup

You only need to do this once. After this, reminders fire even when the browser is fully closed and the phone is locked.

## 1. Run the Supabase migration

Open the Supabase SQL editor and run:

```
supabase/reminders-migration.sql
```

This creates two tables:
- `ts_push_subscriptions` — every device gets a row (upserted by endpoint)
- `ts_reminders` — one row per task with a reminder; `sent_at` flips when fired

## 2. Verify env vars on Vercel

All of these must be set in Vercel → Project → Settings → Environment Variables. **Make sure none have trailing whitespace** (this has bitten us before — PowerShell stdin adds a trailing newline when pasting):

| Name | Where to get it |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | already set (used client-side too) |
| `VAPID_PRIVATE_KEY` | already set |
| `VAPID_SUBJECT` | `mailto:your@email.com` (the route auto-prefixes `mailto:` if missing) |
| `CRON_SECRET` | any long random string — used to authenticate the cron endpoint |

## 3. Pick a cron source

The endpoint is `GET /api/cron/send-reminders` and accepts auth via either:
- `Authorization: Bearer <CRON_SECRET>` header (what Vercel cron sends)
- `?secret=<CRON_SECRET>` query param (what external services send)

**Option A — Vercel Cron (Pro plan):**
Already configured in `vercel.json`. Runs every minute. Vercel attaches the bearer token automatically. Nothing else to do.

**Option B — Vercel Hobby plan:**
Hobby crons only run **daily**, not per-minute. Use a free third-party scheduler instead:

1. Sign up at https://cron-job.org (free, every-minute support)
2. Create a job:
   - URL: `https://thoughtstack-ten.vercel.app/api/cron/send-reminders?secret=YOUR_CRON_SECRET`
   - Schedule: every 1 minute
   - Method: GET
3. Save. Done.

You can also use cronhub.io, easycron.com, or a $5/month Vercel Pro upgrade.

## 4. Verify

After deploying:
1. In the app, go to **Settings → Notifications → Enable**. Accept the OS prompt.
2. Check Supabase — `ts_push_subscriptions` should have one row for your browser/device.
3. Create a task with a reminder set for 2 minutes in the future.
4. Check Supabase — `ts_reminders` should have one row with `sent_at = null`.
5. Close the browser entirely. Wait until the due time.
6. Notification should appear on your device. `sent_at` in `ts_reminders` will fill in.

If notifications don't fire after the due time, hit the cron URL manually in a browser tab (with the `?secret=` param) and check the response. It returns `{ ok: true, due, sent, deadCleaned }`.

## How the dedup works

Both server-push and local-SW reminders use the **task id as the notification `tag`**. The browser only ever displays one notification per tag, so even if the SW fires its setTimeout AND the server cron pushes for the same task, the user sees a single notification.
