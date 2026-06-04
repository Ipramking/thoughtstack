import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

type Row = Record<string, unknown>;

// ─── Client ───────────────────────────────────────────────────────────────────
// Uses service-role key so it bypasses Row Level Security for server operations.
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your environment variables."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Init / seed admin ────────────────────────────────────────────────────────
// Table must exist first — run supabase/migration.sql in your Supabase dashboard.
// This only seeds the admin account on first run.
export async function initDb() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const adminPass  = process.env.ADMIN_PASSWORD ?? "";
  const adminName  = process.env.ADMIN_NAME ?? "Admin";

  if (!adminEmail || !adminPass) return;

  const sb = getSupabase();
  const { data: existing } = await sb
    .from("ts_users")
    .select("id")
    .eq("email", adminEmail)
    .maybeSingle();

  if (!existing) {
    const hash = await bcrypt.hash(adminPass, 12);
    await sb.from("ts_users").insert({
      name:          adminName,
      email:         adminEmail,
      password_hash: hash,
      role:          "admin",
      status:        "approved",
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export async function findUserByEmail(email: string): Promise<Row | null> {
  const { data } = await getSupabase()
    .from("ts_users")
    .select("id, name, email, password_hash, role, status")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  return data ?? null;
}

export async function createUser(
  name: string,
  email: string,
  passwordHash: string
): Promise<Row> {
  const { data, error } = await getSupabase()
    .from("ts_users")
    .insert({ name, email: email.toLowerCase().trim(), password_hash: passwordHash })
    .select("id, name, email, role, status")
    .single();
  if (error) throw error;
  return data as Row;
}

export async function listPendingUsers(): Promise<Row[]> {
  const { data } = await getSupabase()
    .from("ts_users")
    .select("id, name, email, role, status, created_at, approved_at, approved_by")
    .order("created_at", { ascending: false });
  return (data ?? []) as Row[];
}

export async function approveUser(id: string, approvedBy: string): Promise<Row | null> {
  const { data } = await getSupabase()
    .from("ts_users")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: approvedBy })
    .eq("id", id)
    .select("id, name, email, status")
    .maybeSingle();
  return data ?? null;
}

export async function rejectUser(id: string, approvedBy: string): Promise<Row | null> {
  const { data } = await getSupabase()
    .from("ts_users")
    .update({ status: "rejected", approved_by: approvedBy })
    .eq("id", id)
    .select("id, name, email, status")
    .maybeSingle();
  return data ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  await getSupabase()
    .from("ts_users")
    .delete()
    .eq("id", id)
    .neq("role", "admin"); // never delete admin
}

// ─── Self-service helpers (used by the account-management page) ──────────────

/**
 * Verify a user's current password and replace it with a new one.
 * Returns true if the password was updated, false if the current password
 * didn't match. Throws on database error.
 */
export async function changeUserPassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const sb = getSupabase();
  const { data: user } = await sb
    .from("ts_users")
    .select("id, password_hash")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (!user) return false;

  const ok = await bcrypt.compare(currentPassword, user.password_hash as string);
  if (!ok) return false;

  const newHash = await bcrypt.hash(newPassword, 12);
  const { error } = await sb
    .from("ts_users")
    .update({ password_hash: newHash })
    .eq("id", user.id as string)
    .neq("role", "admin");   // never let admin change here without explicit handling

  if (error) throw error;
  return true;
}

/**
 * Permanently delete a user account and every row that belongs to it.
 * Verifies the password first to prevent CSRF-style attacks.
 * Returns true on success, false if password didn't match.
 *
 * Wipes from: ts_tasks, ts_journals, ts_events, ts_push_subscriptions,
 * ts_reminders, ts_tombstones, then finally ts_users.
 */
export async function deleteSelfAccount(
  email: string,
  password: string,
): Promise<boolean> {
  const sb = getSupabase();
  const emailClean = email.toLowerCase().trim();

  const { data: user } = await sb
    .from("ts_users")
    .select("id, password_hash, role")
    .eq("email", emailClean)
    .maybeSingle();

  if (!user) return false;
  // Admins must be deleted by another admin, not self-service
  if (user.role === "admin") throw new Error("admin_cannot_self_delete");

  const ok = await bcrypt.compare(password, user.password_hash as string);
  if (!ok) return false;

  // Wipe owned data first. Missing tables (e.g. tombstones not yet migrated)
  // shouldn't block account deletion — we ignore individual errors.
  const tables = [
    "ts_tasks",
    "ts_journals",
    "ts_events",
    "ts_push_subscriptions",
    "ts_reminders",
    "ts_tombstones",
  ] as const;

  for (const table of tables) {
    await sb.from(table).delete().eq("user_email", emailClean);
  }

  // Finally remove the user
  const { error } = await sb.from("ts_users").delete().eq("id", user.id as string);
  if (error) throw error;
  return true;
}
