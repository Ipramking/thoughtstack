"use client";

import { useTheme } from "next-themes";
import { Settings, Sun, Moon, Trash2, Brain, Shield, Check } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";

function SettingRow({ label, description, action }: {
  label: string; description?: string; action: React.ReactNode;
}) {
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 px-1 mb-1">
      {children}
    </p>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { tasks, journals, skills, events } = useAppStore();

  function clearData(type: "tasks" | "journals" | "skills" | "events" | "all") {
    if (!confirm(`Clear ${type === "all" ? "ALL data" : type}? This cannot be undone.`)) return;
    const s = useAppStore.getState();
    if (type === "tasks")    [...s.tasks].forEach((t) => s.deleteTask(t.id));
    if (type === "journals") [...s.journals].forEach((j) => s.deleteJournal(j.id));
    if (type === "skills")   [...s.skills].forEach((sk) => s.deleteSkill(sk.id));
    if (type === "events")   [...s.events].forEach((e) => s.deleteEvent(e.id));
    if (type === "all") {
      [...s.tasks].forEach((t) => s.deleteTask(t.id));
      [...s.journals].forEach((j) => s.deleteJournal(j.id));
      [...s.skills].forEach((sk) => s.deleteSkill(sk.id));
      [...s.events].forEach((e) => s.deleteEvent(e.id));
      s.clearMessages();
    }
    toast.success(`${type === "all" ? "All data" : type} cleared`);
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="p-4 sm:p-6 space-y-6 page-enter max-w-2xl">
        <PageHeader title="Settings" />

        {/* Appearance */}
        <div className="space-y-2">
          <SectionLabel>Appearance</SectionLabel>
          <Card>
            <CardContent className="p-5">
              <SettingRow
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
                          theme === value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                        {theme === value && <Check className="w-3 h-3 text-primary" />}
                      </button>
                    ))}
                  </div>
                }
              />
            </CardContent>
          </Card>
        </div>

        {/* Thoughts AI */}
        <div className="space-y-2">
          <SectionLabel>Thoughts AI</SectionLabel>
          <Card>
            <CardContent className="p-5 space-y-0 divide-y divide-border/60">
              <SettingRow
                label="Claude API"
                description="Primary AI — set ANTHROPIC_API_KEY in Vercel"
                action={
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                    .env.local
                  </span>
                }
              />
              <SettingRow
                label="Gemini API"
                description="Fallback when Claude is unavailable"
                action={
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                    .env.local
                  </span>
                }
              />
              <SettingRow
                label="Rule-based engine"
                description="Always active — works offline, no API key needed"
                action={
                  <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">
                    Active
                  </span>
                }
              />
              <div className="pt-4">
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
                  onClick={() => { useAppStore.getState().clearMessages(); toast.info("Chat history cleared"); }}>
                  <Trash2 className="w-3.5 h-3.5" /> Clear chat history
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data */}
        <div className="space-y-2">
          <SectionLabel>Data Management</SectionLabel>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>All data is stored locally in your browser. Clearing is permanent.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-0 divide-y divide-border/60">
              {[
                { type: "tasks"    as const, label: "Tasks",           count: tasks.length    },
                { type: "journals" as const, label: "Journal entries", count: journals.length  },
                { type: "skills"   as const, label: "Skills",          count: skills.length    },
                { type: "events"   as const, label: "Calendar events", count: events.length    },
              ].map(({ type, label, count }) => (
                <SettingRow key={type} label={label} description={`${count} ${count === 1 ? "item" : "items"} stored`}
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

        {/* About */}
        <div className="text-center py-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">ThoughtStack</p>
          <p>AI-powered personal OS · Next.js · Supabase · Claude + Gemini</p>
        </div>
      </div>
    </div>
  );
}
