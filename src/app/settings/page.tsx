"use client";

import { useTheme }    from "next-themes";
import { Sun, Moon, Trash2, Bell, CheckCircle2, Check, FlaskConical, Download, Upload, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button }      from "@/components/ui/button";
import { PageHeader }  from "@/components/ui/page-header";
import { cn }          from "@/lib/utils";
import { toast }       from "@/hooks/useToast";
import { useNotifications } from "@/hooks/useNotifications";
import { useRef, useState } from "react";

function Row({ label, description, action }: { label: string; description?: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border/60 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 mb-1">{children}</p>;
}

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { tasks, journals, events }  = useAppStore();
  const { notificationsEnabled, requestPermission, disableNotifications, sendTestNotification } = useNotifications();
  const restoreRef = useRef<HTMLInputElement>(null);
  const [nuking, setNuking] = useState(false);

  async function handleNukeCache() {
    setNuking(true);
    try {
      // 1. Unregister all service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // 2. Delete all Cache Storage entries
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast.success("Cache cleared — reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error("Couldn't clear cache — try a hard reload (Ctrl+Shift+R)");
      setNuking(false);
    }
  }

  function handleBackup() {
    const state = useAppStore.getState();
    const data  = { tasks: state.tasks, journals: state.journals, events: state.events, profile: state.profile, exportedAt: new Date().toISOString() };
    const blob  = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href      = url;
    a.download  = `thoughtstack-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const state = useAppStore.getState();
        if (data.tasks)    data.tasks.forEach((t: Parameters<typeof state.addTask>[0]) => state.addTask(t));
        if (data.journals) data.journals.forEach((j: Parameters<typeof state.addJournal>[0]) => state.addJournal(j));
        if (data.events)   data.events.forEach((ev: Parameters<typeof state.addEvent>[0]) => state.addEvent(ev));
        if (data.profile)  state.updateProfile(data.profile);
        toast.success("Data restored successfully");
      } catch {
        toast.error("Invalid backup file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function clearData(type: "tasks" | "journals" | "events" | "all") {
    if (!confirm(`Clear ${type === "all" ? "ALL data" : type}? This cannot be undone.`)) return;
    const s = useAppStore.getState();
    if (type === "tasks"    || type === "all") [...s.tasks].forEach((t) => s.deleteTask(t.id));
    if (type === "journals" || type === "all") [...s.journals].forEach((j) => s.deleteJournal(j.id));
    if (type === "events"   || type === "all") [...s.events].forEach((e) => s.deleteEvent(e.id));
    if (type === "all") s.clearMessages();
    toast.success(`${type === "all" ? "All data" : type} cleared`);
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-6 page-enter max-w-2xl">
        <PageHeader title="Settings" />

        {/* Appearance */}
        <div className="space-y-2">
          <Section>Appearance</Section>
          <Card><CardContent className="p-5">
            <Row
              label="Theme"
              description="Choose your preferred colour scheme"
              action={
                <div className="flex gap-2">
                  {[
                    { value: "dark",  label: "Dark",  icon: Moon },
                    { value: "light", label: "Light", icon: Sun  },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                        resolvedTheme === value
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border hover:bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      {resolvedTheme === value && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  ))}
                </div>
              }
            />
          </CardContent></Card>
        </div>

        {/* Notifications */}
        <div className="space-y-2">
          <Section>Notifications & Reminders</Section>
          <Card><CardContent className="p-5 space-y-0 divide-y divide-border/60">
            <Row
              label="Push notifications"
              description={notificationsEnabled
                ? "Enabled — you'll get task reminders on this device"
                : "Get notified about task due times, even when the app is closed"}
              action={
                notificationsEnabled ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
                    </span>
                    <Button variant="ghost" size="sm" className="rounded-xl text-xs h-7 px-2 text-muted-foreground" onClick={disableNotifications}>
                      Turn off
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-xl gap-1.5"
                    onClick={async () => await requestPermission()}
                  >
                    <Bell className="w-3.5 h-3.5" /> Enable
                  </Button>
                )
              }
            />
            {notificationsEnabled && (
              <Row
                label="Test notification"
                description="Send a test push to verify it's working"
                action={
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={sendTestNotification}>
                    <FlaskConical className="w-3.5 h-3.5" /> Send test
                  </Button>
                }
              />
            )}
            <Row
              label="Task reminders"
              description="Reminders fire at the task's due time (requires notifications enabled)"
              action={
                <span className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-lg border",
                  notificationsEnabled
                    ? "text-green-400 bg-green-500/10 border-green-500/20"
                    : "text-muted-foreground bg-muted border-border",
                )}>
                  {notificationsEnabled ? "Active" : "Off"}
                </span>
              }
            />
          </CardContent></Card>
        </div>

        {/* AI */}
        <div className="space-y-2">
          <Section>Thoughts AI</Section>
          <Card><CardContent className="p-5 space-y-0 divide-y divide-border/60">
            <Row label="Claude API" description="Primary AI — set ANTHROPIC_API_KEY in Vercel"
              action={<span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">Env var</span>} />
            <Row label="Gemini API" description="Fallback when Claude is unavailable"
              action={<span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">Env var</span>} />
            <Row label="Local engine" description="Always active — context-aware, works offline"
              action={<span className="text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">Always on</span>} />
            <div className="pt-4">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
                onClick={() => { useAppStore.getState().clearMessages(); toast.info("Chat history cleared"); }}>
                <Trash2 className="w-3.5 h-3.5" /> Clear chat history
              </Button>
            </div>
          </CardContent></Card>
        </div>

        {/* Data */}
        <div className="space-y-2">
          <Section>Data Management</Section>
          <Card>
            <CardHeader className="pb-2"><CardDescription>All data is stored locally in your browser. Clearing is permanent.</CardDescription></CardHeader>
            <CardContent className="p-5 pt-0 space-y-0 divide-y divide-border/60">
              {[
                { type: "tasks"    as const, label: "Tasks",           count: tasks.length    },
                { type: "journals" as const, label: "Journal entries", count: journals.length  },
                { type: "events"   as const, label: "Calendar events", count: events.length    },
              ].map(({ type, label, count }) => (
                <Row key={type} label={label} description={`${count} ${count === 1 ? "item" : "items"} stored`}
                  action={
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      onClick={() => clearData(type)} disabled={count === 0}>
                      <Trash2 className="w-3.5 h-3.5" /> Clear
                    </Button>
                  }
                />
              ))}
              <div className="pt-4">
                <Button variant="destructive" size="sm" className="w-full rounded-xl gap-1.5" onClick={() => clearData("all")}>
                  <Trash2 className="w-4 h-4" /> Clear all data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Backup & Restore */}
        <div className="space-y-2">
          <Section>Backup &amp; Restore</Section>
          <Card><CardContent className="p-5 space-y-0 divide-y divide-border/60">
            <Row
              label="Download backup"
              description="Save all your tasks, journals, and events as a JSON file"
              action={
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleBackup}>
                  <Download className="w-3.5 h-3.5" /> Backup
                </Button>
              }
            />
            <Row
              label="Restore from backup"
              description="Import a previously downloaded backup file"
              action={
                <>
                  <input ref={restoreRef} type="file" accept=".json" className="hidden" onChange={handleRestore} />
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => restoreRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" /> Restore
                  </Button>
                </>
              }
            />
          </CardContent></Card>
        </div>

        {/* Troubleshooting */}
        <div className="space-y-2">
          <Section>Troubleshooting</Section>
          <Card><CardContent className="p-5 space-y-0 divide-y divide-border/60">
            <Row
              label="Clear app cache & reload"
              description="Fixes stale pages, broken chunks, and service worker errors. Your data is safe — this only clears the browser cache."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={handleNukeCache}
                  disabled={nuking}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", nuking && "animate-spin")} />
                  {nuking ? "Clearing…" : "Clear & reload"}
                </Button>
              }
            />
          </CardContent></Card>
        </div>

        <div className="text-center py-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">ThoughtStack</p>
          <p>AI-powered personal OS · Next.js · Supabase · Claude + Gemini</p>
        </div>
      </div>
    </div>
  );
}
