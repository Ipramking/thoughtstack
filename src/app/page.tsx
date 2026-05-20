"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CheckSquare, BookOpen, Zap, Calendar, BarChart2,
  Brain, TrendingUp, Clock, Flame, ArrowRight, Plus,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { isToday, formatDate, cn } from "@/lib/utils";

const MOOD_EMOJI: Record<string, string> = {
  great: "😄", good: "🙂", neutral: "😐", bad: "😕", awful: "😞",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-blue-400", medium: "bg-yellow-400",
  high: "bg-orange-400", critical: "bg-red-400",
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
    () => events.filter((e) => isToday(e.date))
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")),
    [events]
  );
  const recentJournal = journals[0];
  const activeSkills  = skills.filter((s) => s.progress < 100);
  const completionRate = tasks.length
    ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100)
    : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="min-h-screen ambient-bg">
      <div className="p-4 sm:p-6 space-y-6 page-enter">

        {/* ── Hero header ── */}
        <div className="flex items-start justify-between gap-4 pt-2">
          <div>
            <p className="text-sm text-muted-foreground mb-0.5">{formatDate(new Date())}</p>
            <h1 className="text-2xl font-bold tracking-tight">
              {greeting()}, {firstName} 👋
            </h1>
          </div>
          <Button
            onClick={toggleThoughtsPanel}
            size="sm"
            className="gap-2 rounded-xl shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask Thoughts
          </Button>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <StatCard
            label="Tasks today"
            value={todayTasks.length}
            sub={`${completedToday} completed`}
            icon={Flame}
            iconColor="text-orange-400"
          />
          <StatCard
            label="Completion"
            value={`${completionRate}%`}
            sub={`${tasks.filter(t => t.status === "done").length} total done`}
            icon={TrendingUp}
            iconColor="text-green-400"
          />
          <StatCard
            label="Active skills"
            value={activeSkills.length}
            sub={`${skills.length} tracked`}
            icon={Zap}
            iconColor="text-yellow-400"
          />
          <StatCard
            label="Events today"
            value={todayEvents.length}
            sub={todayEvents[0] ? `Next: ${todayEvents[0].startTime ?? "all day"}` : "None scheduled"}
            icon={Calendar}
            iconColor="text-purple-400"
          />
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left col — tasks + schedule */}
          <div className="lg:col-span-2 space-y-4">

            {/* Today's Tasks */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Today&apos;s Tasks
                </CardTitle>
                <Link href="/tasks">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 rounded-lg">
                    View all <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-1.5">
                {todayTasks.length === 0 ? (
                  <EmptyState
                    icon={CheckSquare}
                    title="No tasks due today"
                    description="Enjoy your free time or plan ahead."
                    action={
                      <Link href="/tasks">
                        <Button size="sm" variant="outline" className="gap-1 rounded-lg">
                          <Plus className="w-3.5 h-3.5" /> Add task
                        </Button>
                      </Link>
                    }
                    className="py-8"
                  />
                ) : (
                  todayTasks.slice(0, 5).map((task) => (
                    <Link key={task.id} href="/tasks">
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group">
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125",
                          PRIORITY_DOT[task.priority]
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          {task.dueTime && (
                            <p className="text-xs text-muted-foreground">{task.dueTime}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-md shrink-0">
                          {task.priority}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Today's Schedule */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  Today&apos;s Schedule
                </CardTitle>
                <Link href="/calendar">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 rounded-lg">
                    Calendar <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-2">
                {todayEvents.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="Nothing scheduled"
                    description="Your day is open — add an event."
                    className="py-8"
                  />
                ) : (
                  todayEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40">
                      <div className="text-xs text-muted-foreground w-14 shrink-0 font-medium text-right">
                        {event.startTime ?? "All day"}
                      </div>
                      <div className="w-px h-6 bg-border shrink-0" />
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

          {/* Right col */}
          <div className="space-y-4">

            {/* Skills */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Learning
                </CardTitle>
                <Link href="/skills">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 rounded-lg">
                    Skills <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-4">
                {activeSkills.length === 0 ? (
                  <EmptyState
                    icon={Zap}
                    title="No skills tracked"
                    action={
                      <Link href="/skills">
                        <Button size="sm" variant="outline" className="gap-1 rounded-lg text-xs">
                          <Plus className="w-3 h-3" /> Track a skill
                        </Button>
                      </Link>
                    }
                    className="py-6"
                  />
                ) : (
                  activeSkills.slice(0, 3).map((skill) => (
                    <div key={skill.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{skill.name}</p>
                        <span className="text-xs text-muted-foreground">Lv.{skill.level}</span>
                      </div>
                      <Progress value={skill.progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{skill.progress}% · {skill.xp} XP</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Journal */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-green-400" />
                  Journal
                </CardTitle>
                <Link href="/journal">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 rounded-lg">
                    Open <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                {recentJournal ? (
                  <Link href="/journal">
                    <div className="p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xl">{MOOD_EMOJI[recentJournal.mood ?? "neutral"]}</span>
                        <p className="text-sm font-semibold truncate">{recentJournal.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {recentJournal.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {formatDate(recentJournal.createdAt)}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <EmptyState
                    icon={BookOpen}
                    title="No entries yet"
                    action={
                      <Link href="/journal">
                        <Button size="sm" variant="outline" className="gap-1 rounded-lg text-xs">
                          <Plus className="w-3 h-3" /> Write first entry
                        </Button>
                      </Link>
                    }
                    className="py-6"
                  />
                )}
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-400" />
                  Quick Stats
                </CardTitle>
                <Link href="/analytics">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 rounded-lg">
                    Full report <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 grid grid-cols-2 gap-2">
                {[
                  { label: "Total tasks",  value: tasks.length  },
                  { label: "Journals",     value: journals.length },
                  { label: "Skills",       value: skills.length  },
                  { label: "Events",       value: events.length  },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center p-2.5 rounded-xl bg-muted/40">
                    <p className="text-xl font-bold">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
