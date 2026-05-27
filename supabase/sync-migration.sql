-- ThoughtStack cross-device sync tables
-- Run once in Supabase SQL Editor

-- Tasks
CREATE TABLE IF NOT EXISTS ts_tasks (
  id          TEXT PRIMARY KEY,
  user_email  TEXT NOT NULL,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ts_tasks_user ON ts_tasks (user_email);

-- Journal entries
CREATE TABLE IF NOT EXISTS ts_journals (
  id          TEXT PRIMARY KEY,
  user_email  TEXT NOT NULL,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ts_journals_user ON ts_journals (user_email);

-- Calendar events
CREATE TABLE IF NOT EXISTS ts_events (
  id          TEXT PRIMARY KEY,
  user_email  TEXT NOT NULL,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ts_events_user ON ts_events (user_email);

-- Row-Level Security (optional, since we use service role key server-side)
ALTER TABLE ts_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_events   ENABLE ROW LEVEL SECURITY;
