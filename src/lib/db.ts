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
