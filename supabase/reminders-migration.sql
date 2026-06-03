-- ─────────────────────────────────────────────────────────────────────────────
-- ThoughtStack — server-side push notifications
-- Run once in Supabase SQL Editor (after sync-migration.sql)
-- ─────────────────────────────────────────────────────────────────────────────

-- Push subscriptions (one row per device — endpoint is unique per device)
CREATE TABLE IF NOT EXISTS ts_push_subscriptions (
  id            BIGSERIAL PRIMARY KEY,
  user_email    TEXT NOT NULL,
  endpoint      TEXT NOT NULL UNIQUE,
  subscription  JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ts_push_subs_user ON ts_push_subscriptions (user_email);

-- Scheduled reminders. id = task id (one reminder per task; re-scheduling upserts)
CREATE TABLE IF NOT EXISTS ts_reminders (
  id            TEXT PRIMARY KEY,
  user_email    TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  url           TEXT DEFAULT '/',
  due_at        TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
-- Cron query: WHERE sent_at IS NULL AND due_at <= now()
CREATE INDEX IF NOT EXISTS ts_reminders_pending
  ON ts_reminders (due_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS ts_reminders_user ON ts_reminders (user_email);

-- Optional cleanup: drop already-sent reminders older than 7 days
-- (Run periodically to keep the table small. The cron endpoint also does this.)
-- DELETE FROM ts_reminders WHERE sent_at IS NOT NULL AND sent_at < now() - interval '7 days';

ALTER TABLE ts_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_reminders          ENABLE ROW LEVEL SECURITY;
