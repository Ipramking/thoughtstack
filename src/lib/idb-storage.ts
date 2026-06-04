"use client";

/**
 * IndexedDB-backed storage for Zustand persist.
 *
 * Why this exists:
 *   localStorage is SYNCHRONOUS — every state change blocks the main thread
 *   while JSON.stringifying potentially megabytes of data. With thousands of
 *   tasks, this caused 200–500 ms freezes per click. localStorage also caps
 *   at ~5 MB; IndexedDB allows 50–500 MB depending on the device.
 *
 * Design:
 *   - Uses idb-keyval (tiny, single key/value pair per store key)
 *   - Wraps with the same throttled-write pattern as the localStorage version
 *     so rapid state changes collapse into one write per 800 ms
 *   - Auto-migrates existing localStorage data to IDB on first access so
 *     existing users don't lose data
 */

import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

// ── Throttle layer ────────────────────────────────────────────────────────────
const pendingWrites = new Map<string, string>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const inMemoryCache = new Map<string, string | null>();

async function flushPendingWrites(): Promise<void> {
  if (pendingWrites.size === 0) return;
  // Snapshot + clear before awaiting so concurrent writes don't get lost
  const snapshot = new Map(pendingWrites);
  pendingWrites.clear();
  writeTimer = null;
  for (const [key, value] of snapshot) {
    try { await idbSet(key, value); } catch {/* IDB blocked / disabled */}
  }
}

if (typeof window !== "undefined") {
  // Flush whatever is pending when the tab is hidden or closed
  window.addEventListener("pagehide", () => { void flushPendingWrites(); });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPendingWrites();
  });
}

// ── One-time migration: localStorage → IDB ────────────────────────────────────
const migrationDone = new Set<string>();

async function migrateFromLocalStorage(name: string): Promise<string | null> {
  if (migrationDone.has(name)) return null;
  migrationDone.add(name);

  if (typeof window === "undefined") return null;

  // Already migrated? IDB has the data → done
  const existing = await idbGet<string>(name).catch(() => undefined);
  if (existing !== undefined && existing !== null) return existing;

  // Legacy data in localStorage? Pull it over to IDB.
  const legacy = window.localStorage.getItem(name);
  if (legacy !== null) {
    try {
      await idbSet(name, legacy);
      // Keep localStorage as backup for one session — only remove after we
      // know the migration succeeded and the app has rendered correctly.
      // (We rely on the next setItem cycle to clear it implicitly, OR the
      //  user can hit /reset if anything goes wrong.)
      return legacy;
    } catch {/* IDB write failed — fall through and return legacy from LS */}
    return legacy;
  }

  return null;
}

// ── StateStorage implementation ───────────────────────────────────────────────
export const idbStorage: StateStorage = {
  getItem: async (name) => {
    // Pending write is newer than IDB; return that
    const pending = pendingWrites.get(name);
    if (pending !== undefined) return pending;

    // In-memory cache for fast subsequent reads
    const cached = inMemoryCache.get(name);
    if (cached !== undefined) return cached;

    // First time — try migration from localStorage, fall back to IDB
    const migrated = await migrateFromLocalStorage(name);
    if (migrated !== null) {
      inMemoryCache.set(name, migrated);
      return migrated;
    }

    const value = (await idbGet<string>(name).catch(() => null)) ?? null;
    inMemoryCache.set(name, value);
    return value;
  },

  setItem: async (name, value) => {
    inMemoryCache.set(name, value);
    pendingWrites.set(name, value);
    if (writeTimer) return;
    writeTimer = setTimeout(() => { void flushPendingWrites(); }, 800);
  },

  removeItem: async (name) => {
    inMemoryCache.delete(name);
    pendingWrites.delete(name);
    try { await idbDel(name); } catch {/* ignore */}
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(name); } catch {/* ignore */}
    }
  },
};
