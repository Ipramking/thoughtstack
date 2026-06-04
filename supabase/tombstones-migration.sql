-- ─────────────────────────────────────────────────────────────────────────────
-- ThoughtStack — tombstones table (cross-device deletion fix)
-- Run once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- WHY:
-- When Device A deletes task X, the row gets removed from ts_tasks server-side.
-- But Device B still has X in its localStorage. On Device B's next push, it
-- upserts X back into ts_tasks. Device A then pulls X back. The delete never
-- sticks.
--
-- FIX:
-- DELETE /api/sync now ALSO inserts a row into ts_tombstones. GET /api/sync
-- returns the user's tombstones, and the client removes anything in the
-- tombstone list from local state. Tombstones auto-expire after 30 days
-- (after that, every device should have synced the deletion).

CREATE TABLE IF NOT EXISTS ts_tombstones (
  id          TEXT NOT NULL,                        -- the deleted item's id
  type        TEXT NOT NULL,                        -- 'tasks' | 'journals' | 'events'
  user_email  TEXT NOT NULL,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, type, user_email)
);

CREATE INDEX IF NOT EXISTS ts_tombstones_user
  ON ts_tombstones (user_email, type);

-- Optional: periodically clean up old tombstones. Safe to skip — table is tiny.
-- DELETE FROM ts_tombstones WHERE deleted_at < now() - interval '30 days';

ALTER TABLE ts_tombstones ENABLE ROW LEVEL SECURITY;
