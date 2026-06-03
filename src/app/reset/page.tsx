"use client";

/**
 * /reset — Emergency rescue page.
 *
 * Minimal dependencies, minimal rendering. Loads instantly even when the
 * main app is frozen by huge localStorage data. Lets users wipe everything
 * and start fresh without having to navigate through the laggy app.
 */

import { useState } from "react";

export default function ResetPage() {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [log,    setLog]    = useState<string[]>([]);

  function append(line: string) {
    setLog((l) => [...l, line]);
  }

  async function nukeEverything() {
    setStatus("running");
    setLog([]);

    try {
      // 1. Unregister every service worker
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        append(`Unregistering ${regs.length} service worker(s)...`);
        await Promise.all(regs.map((r) => r.unregister()));
      }

      // 2. Delete every Cache Storage entry
      if ("caches" in window) {
        const keys = await caches.keys();
        append(`Deleting ${keys.length} cache(s)...`);
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // 3. Clear all localStorage (this is the big one — kills the freeze source)
      append(`Clearing localStorage (${localStorage.length} key(s))...`);
      localStorage.clear();

      // 4. Clear sessionStorage too
      append(`Clearing sessionStorage...`);
      sessionStorage.clear();

      // 5. Wipe IndexedDB (in case anything's there)
      if ("indexedDB" in window) {
        try {
          const dbs = await indexedDB.databases?.();
          if (dbs) {
            append(`Deleting ${dbs.length} IndexedDB database(s)...`);
            await Promise.all(
              dbs.map((db) => db.name ? new Promise<void>((res) => {
                const req = indexedDB.deleteDatabase(db.name!);
                req.onsuccess = () => res();
                req.onerror = () => res();
                req.onblocked = () => res();
              }) : Promise.resolve())
            );
          }
        } catch {/* indexedDB.databases() not supported in all browsers */}
      }

      append("Done. Reloading in 2 seconds...");
      setStatus("done");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err) {
      append(`Error: ${(err as Error).message}`);
      setStatus("idle");
    }
  }

  return (
    <div style={{
      minHeight:   "100vh",
      display:     "flex",
      alignItems:  "center",
      justifyContent: "center",
      padding:     "1.5rem",
      fontFamily:  "system-ui, -apple-system, sans-serif",
      background:  "#0d0d0d",
      color:       "#fff",
    }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Rescue mode
        </h1>
        <p style={{ fontSize: 14, color: "#a0a0a0", lineHeight: 1.6, marginBottom: 24 }}>
          This page wipes all locally stored data, unregisters the service worker,
          and clears every cache. Your data on the server (Supabase) is{" "}
          <strong style={{ color: "#fff" }}>untouched</strong> — when you sign in
          again, it will pull fresh from there.
        </p>

        {status === "idle" && (
          <button
            onClick={nukeEverything}
            style={{
              width:        "100%",
              padding:      "14px 20px",
              borderRadius: 12,
              background:   "#dc2626",
              color:        "#fff",
              fontSize:     15,
              fontWeight:   600,
              border:       "none",
              cursor:       "pointer",
            }}
          >
            Wipe everything and reload
          </button>
        )}

        {status !== "idle" && (
          <div style={{
            padding:      16,
            borderRadius: 12,
            background:   "#1a1a1a",
            border:       "1px solid #333",
            fontSize:     12,
            fontFamily:   "ui-monospace, monospace",
            lineHeight:   1.7,
          }}>
            {log.map((line, i) => (
              <div key={i} style={{ color: "#a0e0a0" }}>{line}</div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 12, color: "#666", marginTop: 24, lineHeight: 1.6 }}>
          After the wipe completes, the app will redirect to the home page.
          You may need to log in again. Your tasks, journals, and events stored
          on Supabase will be pulled back automatically — but any local-only
          edits you haven&apos;t synced will be lost.
        </p>
      </div>
    </div>
  );
}
