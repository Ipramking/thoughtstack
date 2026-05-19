"use client";

import { Download, FileJson, CheckSquare, BookOpen, Zap, Calendar } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { tasks, journals, skills, events, profile, dailyStats } = useAppStore();

  const sections = [
    {
      label: "Tasks",
      icon: CheckSquare,
      color: "text-blue-400",
      count: tasks.length,
      onExport: () => downloadJSON(tasks, "thoughtstack-tasks.json"),
    },
    {
      label: "Journal entries",
      icon: BookOpen,
      color: "text-green-400",
      count: journals.length,
      onExport: () => downloadJSON(journals, "thoughtstack-journals.json"),
    },
    {
      label: "Skills & progress",
      icon: Zap,
      color: "text-yellow-400",
      count: skills.length,
      onExport: () => downloadJSON(skills, "thoughtstack-skills.json"),
    },
    {
      label: "Calendar events",
      icon: Calendar,
      color: "text-purple-400",
      count: events.length,
      onExport: () => downloadJSON(events, "thoughtstack-events.json"),
    },
  ];

  function exportAll() {
    downloadJSON({ profile, tasks, journals, skills, events, dailyStats }, "thoughtstack-full-backup.json");
  }

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Download className="w-6 h-6" /> Data Export
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Export your data as JSON files for backup or migration
        </p>
      </div>

      {/* Full backup */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <FileJson className="w-4 h-4" /> Full backup
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Export everything — profile, tasks, journals, skills, events
            </p>
          </div>
          <Button onClick={exportAll} className="gap-1 shrink-0">
            <Download className="w-4 h-4" /> Export all
          </Button>
        </CardContent>
      </Card>

      {/* Individual exports */}
      <div className="space-y-3">
        {sections.map(({ label, icon: Icon, color, count, onExport }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{count} {count === 1 ? "item" : "items"}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                disabled={count === 0}
                className="gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Data is exported as JSON and stored only in your browser. ThoughtStack never sends your data to external servers.
      </p>
    </div>
  );
}
