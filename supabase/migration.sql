-- ThoughtStack — run this ONCE in your Supabase dashboard:
-- Project → SQL Editor → paste this → Run

CREATE TABLE IF NOT EXISTS ts_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user'    CHECK (role    IN ('user', 'admin')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status  IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at   TIMESTAMPTZ,
  approved_by   TEXT
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS ts_users_email_idx ON ts_users (email);

-- Disable Row Level Security (the app uses the service-role key server-side)
ALTER TABLE ts_users DISABLE ROW LEVEL SECURITY;
