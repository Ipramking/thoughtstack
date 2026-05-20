import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

type Row = Record<string, unknown>;

let _sql: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL env var is missing — add it in Vercel settings.");
  }
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// ─── Schema + seed ────────────────────────────────────────────────────────────
export async function initDb() {
  const db = sql();

  await db`
    CREATE TABLE IF NOT EXISTS ts_users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at   TIMESTAMPTZ,
      approved_by   TEXT
    )
  `;

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const adminPass  = process.env.ADMIN_PASSWORD ?? "";
  const adminName  = process.env.ADMIN_NAME ?? "Admin";

  if (adminEmail && adminPass) {
    const rows = await db`SELECT id FROM ts_users WHERE email = ${adminEmail}` as Row[];
    if (rows.length === 0) {
      const hash = await bcrypt.hash(adminPass, 12);
      await db`
        INSERT INTO ts_users (name, email, password_hash, role, status)
        VALUES (${adminName}, ${adminEmail}, ${hash}, 'admin', 'approved')
        ON CONFLICT (email) DO NOTHING
      `;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export async function findUserByEmail(email: string): Promise<Row | null> {
  const db   = sql();
  const rows = await db`
    SELECT id, name, email, password_hash, role, status
    FROM ts_users WHERE email = ${email.toLowerCase().trim()}
  ` as Row[];
  return rows[0] ?? null;
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<Row> {
  const db   = sql();
  const rows = await db`
    INSERT INTO ts_users (name, email, password_hash)
    VALUES (${name}, ${email.toLowerCase().trim()}, ${passwordHash})
    RETURNING id, name, email, role, status
  ` as Row[];
  return rows[0];
}

export async function listPendingUsers(): Promise<Row[]> {
  const db = sql();
  return db`
    SELECT id, name, email, role, status, created_at, approved_at, approved_by
    FROM ts_users
    ORDER BY created_at DESC
  ` as Promise<Row[]>;
}

export async function approveUser(id: string, approvedBy: string): Promise<Row | null> {
  const db   = sql();
  const rows = await db`
    UPDATE ts_users
    SET status = 'approved', approved_at = NOW(), approved_by = ${approvedBy}
    WHERE id = ${id}
    RETURNING id, name, email, status
  ` as Row[];
  return rows[0] ?? null;
}

export async function rejectUser(id: string, approvedBy: string): Promise<Row | null> {
  const db   = sql();
  const rows = await db`
    UPDATE ts_users
    SET status = 'rejected', approved_by = ${approvedBy}
    WHERE id = ${id}
    RETURNING id, name, email, status
  ` as Row[];
  return rows[0] ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  const db = sql();
  await db`DELETE FROM ts_users WHERE id = ${id} AND role != 'admin'`;
}
