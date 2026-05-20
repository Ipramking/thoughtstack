import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

// Lazily-initialised connection
let _sql: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL env var is missing — add it in Vercel settings.");
  }
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
export async function initDb() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS ts_users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
      status      TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      approved_by TEXT
    )
  `;

  // Seed admin account from env vars on first run
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const adminPass  = process.env.ADMIN_PASSWORD ?? "";
  const adminName  = process.env.ADMIN_NAME ?? "Admin";

  if (adminEmail && adminPass) {
    const [existing] = await db`SELECT id FROM ts_users WHERE email = ${adminEmail}`;
    if (!existing) {
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
export async function findUserByEmail(email: string) {
  const db = sql();
  const [user] = await db`
    SELECT id, name, email, password_hash, role, status
    FROM ts_users WHERE email = ${email.toLowerCase().trim()}
  `;
  return user ?? null;
}

export async function createUser(name: string, email: string, passwordHash: string) {
  const db = sql();
  const [user] = await db`
    INSERT INTO ts_users (name, email, password_hash)
    VALUES (${name}, ${email.toLowerCase().trim()}, ${passwordHash})
    RETURNING id, name, email, role, status
  `;
  return user;
}

export async function listPendingUsers() {
  const db = sql();
  return db`
    SELECT id, name, email, role, status, created_at
    FROM ts_users
    ORDER BY created_at DESC
  `;
}

export async function approveUser(id: string, approvedBy: string) {
  const db = sql();
  const [user] = await db`
    UPDATE ts_users
    SET status = 'approved', approved_at = NOW(), approved_by = ${approvedBy}
    WHERE id = ${id}
    RETURNING id, name, email, status
  `;
  return user ?? null;
}

export async function rejectUser(id: string, approvedBy: string) {
  const db = sql();
  const [user] = await db`
    UPDATE ts_users
    SET status = 'rejected', approved_by = ${approvedBy}
    WHERE id = ${id}
    RETURNING id, name, email, status
  `;
  return user ?? null;
}

export async function deleteUser(id: string) {
  const db = sql();
  await db`DELETE FROM ts_users WHERE id = ${id} AND role != 'admin'`;
}
