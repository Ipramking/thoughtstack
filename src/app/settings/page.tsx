"use client";

import { useTheme } from "next-themes";
import { Settings, Sun, Moon, Trash2, Brain, Shield } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { tasks, journals, skills, events } = useAppStore();

  function clearData(type: "tasks" | "journals" | "skills" | "events" | "all") {
    if (!confirm(`Are you sure you want to clear ${type === "all" ? "ALL data" : type}? This cannot be undone.`)) return;
    const s = useAppStore.getState();
    if (type === "tasks") [...s.tasks].forEach((t) => s.deleteTask(t.id));
    else if (type === "journals") [...s.journals].forEach((j) => s.deleteJournal(j.id));
    else if (type === "skills") [...s.skills].forEach((sk) => s.deleteSkill(sk.id));
    else if (type === "events") [...s.events].forEach((e) => s.deleteEvent(e.id));
    else if (type === "all") {
      [...s.tasks].forEach((t) => s.deleteTask(t.id));
      [...s.journals].forEach((j) => s.deleteJournal(j.id));
      [...s.skills].forEach((sk) => s.deleteSkill(sk.id));
      [...s.events].forEach((e) => s.deleteEvent(e.id));
      s.clearMessages();
    }
  }

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6" /> Settings
      </h1>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sun className="w-4 h-4" /> Appearance
          </CardTitle>
          <CardDescription>Choose your preferred color theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[
              { value: "dark", label: "Dark", icon: Moon },
              { value: "light", label: "Light", icon: Sun },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  theme === value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4" /> Thoughts AI
          </CardTitle>
          <CardDescription>Configure your AI assistant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Claude API</p>
              <p className="text-xs text-muted-foreground">
                Set ANTHROPIC_API_KEY in .env.local to enable the full AI
              </p>
            </div>
            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              .env.local
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Rule-based fallback</p>
              <p className="text-xs text-muted-foreground">
                Always active — used when the API is unavailable
              </p>
            </div>
            <div className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">Active</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => useAppStore.getState().clearMessages()}
          >
            Clear chat history
          </Button>
        </CardContent>
      </Card>

      {/* Data management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" /> Data Management
          </CardTitle>
          <CardDescription>
            All data is stored locally in your browser. Clearing is permanent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { type: "tasks" as const, label: "Tasks", count: tasks.length },
            { type: "journals" as const, label: "Journal entries", count: journals.length },
            { type: "skills" as const, label: "Skills", count: skills.length },
            { type: "events" as const, label: "Calendar events", count: events.length },
          ].map(({ type, label, count }) => (
            <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <span className="text-sm">{label} <span className="text-muted-foreground">({count})</span></span>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive gap-1"
                onClick={() => clearData(type)}
                disabled={count === 0}
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </Button>
            </div>
          ))}
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1"
              onClick={() => clearData("all")}
            >
              <Trash2 className="w-4 h-4" /> Clear all data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="p-4 text-center text-xs text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">ThoughtStack</p>
          <p>Your AI-powered personal operating system</p>
          <p className="mt-1">Built with Next.js · Zustand · Claude AI · Recharts</p>
        </CardContent>
      </Card>
    </div>
  );
}
