"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CheckSquare, BookOpen, Zap, Calendar, BarChart2,
  Brain, TrendingUp, Clock, Flame, ArrowRight, Plus,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { isToday, formatDate, cn } from "@/lib/utils";

const MOOD_EMOJI: Record<string, string> = {
  great: "😄", good: "🙂", neutral: "😐", bad: "😕", awful: "😞",
};


export default function HomePage() {
  const { tasks, journals, skills, events, profile, toggleThoughtsPanel } = useAppStore();

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate && isToday(t.dueDate) && t.status !== "done"),
    [tasks]
  );
  const completedToday = useMemo(
    () => tasks.filter((t) => t.status === "done" && t.updatedAt && isToday(t.updatedAt)).length,
    [tasks]
  );
  const todayEvents = useMemo(
    () => events.filter((e) => isToday(e.date)).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")),
    [events]
  );
  const recentJournal = journals[0];
  const activeSkills = skills.filter((s) => s.progress < 100);
  const completionRate = tasks.length
    ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100)
    : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting()}, {profile.name.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {formatDate(new Date())} · Here&apos;s your daily overview
          </p>
        </div>
        <Button onClick={toggleThoughtsPanel} className="gap-2">
          <Brain className="w-4 h-4" />
          Ask Thoughts
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Tasks today",
            value: todayTasks.length,
            sub: `${completedToday} completed`,
            icon: CheckSquare,
            color: "text-blue-400",
          },
          {
            label: "Completion rate",
            value: `${completionRate}%`,
            sub: `${tasks.filter((t) => t.status === "done").length} total done`,
            icon: TrendingUp,
            color: "text-green-400",
          },
          {
            label: "Active skills",
            value: activeSkills.length,
            sub: skills.length > 0 ? `${skills.length} tracked` : "Start tracking",
            icon: Zap,
            color: "text-yellow-400",
          },
          {
            label: "Today events",
            value: todayEvents.length,
            sub: todayEvents[0]
              ? `Next: ${todayEvents[0].startTime ?? "all day"}`
              : "No events",
            icon: Calendar,
            color: "text-purple-400",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
                <Icon className={cn("w-5 h-5", color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today tasks */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                Today&apos;s Tasks
              </CardTitle>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View all <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayTasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No tasks due today</p>
                  <Link href="/tasks">
                    <Button size="sm" variant="outline" className="mt-3 gap-1">
                      <Plus className="w-3 h-3" /> Add task
                    </Button>
                  </Link>
                </div>
              ) : (
                todayTasks.slice(0, 5).map((task) => (
                  <Link key={task.id} href="/tasks">
                    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        task.priority === "critical" ? "bg-red-400" :
                        task.priority === "high" ? "bg-orange-400" :
                        task.priority === "medium" ? "bg-yellow-400" : "bg-blue-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {task.dueTime && (
                          <p className="text-xs text-muted-foreground">{task.dueTime}</p>
                        )}
                      </div>
                      <Badge variant={task.priority as "low" | "medium" | "high" | "critical"} className="text-[10px]">
                        {task.priority}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Today schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Today&apos;s Schedule
              </CardTitle>
              <Link href="/calendar">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  Calendar <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayEvents.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No events today</p>
                </div>
              ) : (
                todayEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground w-12 shrink-0 text-right">
                      {event.startTime ?? "All day"}
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{event.type}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Skill progress */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Learning
              </CardTitle>
              <Link href="/skills">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  Skills <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeSkills.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No skills tracked yet</p>
                  <Link href="/skills">
                    <Button size="sm" variant="outline" className="mt-2 gap-1 text-xs">
                      <Plus className="w-3 h-3" /> Track a skill
                    </Button>
                  </Link>
                </div>
              ) : (
                activeSkills.slice(0, 3).map((skill) => (
                  <div key={skill.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium">{skill.name}</p>
                      <span className="text-xs text-muted-foreground">Lv.{skill.level}</span>
                    </div>
                    <Progress value={skill.progress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground mt-1">{skill.progress}% · {skill.xp} XP</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent journal */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-green-400" />
                Journal
              </CardTitle>
              <Link href="/journal">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  Open <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentJournal ? (
                <Link href="/journal">
                  <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{MOOD_EMOJI[recentJournal.mood ?? "neutral"]}</span>
                      <p className="text-sm font-medium truncate">{recentJournal.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{recentJournal.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{formatDate(recentJournal.createdAt)}</p>
                  </div>
                </Link>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No journal entries yet</p>
                  <Link href="/journal">
                    <Button size="sm" variant="outline" className="mt-2 gap-1 text-xs">
                      <Plus className="w-3 h-3" /> New entry
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick analytics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                Quick Stats
              </CardTitle>
              <Link href="/analytics">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  Full report <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[
                { label: "Total tasks", value: tasks.length },
                { label: "Journals", value: journals.length },
                { label: "Skills", value: skills.length },
                { label: "Events", value: events.length },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
