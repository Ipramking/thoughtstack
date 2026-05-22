"use client";

import { useMemo } from "react";
import {
  TrendingUp, CheckCircle2, BookOpen, Zap,
  Brain, Smile, Activity, Calendar, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { format, subDays, eachDayOfInterval } from "date-fns";

const MOOD_SCORES: Record<string, number> = {
  great: 5, good: 4, neutral: 3, bad: 2, awful: 1,
};
const MOOD_EMOJI: Record<string, string> = {
  great: "😄", good: "🙂", neutral: "😐", bad: "😕", awful: "😞",
};
const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AnalyticsPage() {
  const { tasks, journals, skills, events, toggleThoughtsPanel } = useAppStore();

  // Last 7 days
  const last7Days = useMemo(
    () => eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }),
    []
  );

  const tasksByDay = useMemo(() => {
    return last7Days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const created = tasks.filter((t) => t.createdAt.startsWith(key)).length;
      const done = tasks.filter((t) => t.updatedAt.startsWith(key) && t.status === "done").length;
      return { day: format(day, "EEE"), created, done };
    });
  }, [tasks, last7Days]);

  const moodByDay = useMemo(() => {
    return last7Days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const entry = journals.find((j) => j.createdAt.startsWith(key));
      return {
        day: format(day, "EEE"),
        score: entry?.mood ? MOOD_SCORES[entry.mood] : null,
      };
    }).filter((d) => d.score !== null);
  }, [journals, last7Days]);

  const priorityBreakdown = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    tasks.forEach((t) => counts[t.priority]++);
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((e) => e.value > 0);
  }, [tasks]);

  const skillProgress = useMemo(() =>
    skills.map((s) => ({ name: s.name, progress: s.progress, level: s.level, xp: s.xp })),
    [skills]
  );

  const completionRate = tasks.length
    ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100)
    : 0;

  const avgMood = useMemo(() => {
    const scored = journals.filter((j) => j.mood);
    if (!scored.length) return null;
    const avg = scored.reduce((a, j) => a + MOOD_SCORES[j.mood!], 0) / scored.length;
    return avg.toFixed(1);
  }, [journals]);

  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => {
      const cat = t.category || "Uncategorized";
      counts[cat] = (counts[cat] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-4 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-5 page-enter">
      <PageHeader
        title="Analytics"
        subtitle="Your personal performance overview"
        action={
          <Button variant="outline" size="sm" onClick={toggleThoughtsPanel} className="gap-1.5 rounded-xl">
            <Brain className="w-3.5 h-3.5" /> Weekly report
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Completion rate",
            value: `${completionRate}%`,
            sub: `${tasks.filter((t) => t.status === "done").length} of ${tasks.length} tasks`,
            icon: CheckCircle2,
            color: "text-green-400",
          },
          {
            label: "Journal entries",
            value: journals.length,
            sub: avgMood ? `Avg mood: ${avgMood}/5` : "No mood data",
            icon: BookOpen,
            color: "text-purple-400",
          },
          {
            label: "Skills tracked",
            value: skills.length,
            sub: `${skills.reduce((a, s) => a + s.totalXp, 0)} total XP`,
            icon: Zap,
            color: "text-yellow-400",
          },
          {
            label: "Events scheduled",
            value: events.length,
            sub: `${events.filter((e) => e.date >= format(new Date(), "yyyy-MM-dd")).length} upcoming`,
            icon: Calendar,
            color: "text-blue-400",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
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

      <Tabs defaultValue="productivity">
        <TabsList>
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="wellness">Wellness</TabsTrigger>
        </TabsList>

        {/* Productivity tab */}
        <TabsContent value="productivity" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" /> Tasks This Week
                </CardTitle>
                <CardDescription>Created vs. completed per day</CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No task data yet — start adding tasks!
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={tasksByDay} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="created" name="Created" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="done" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-400" /> Priority Breakdown
                </CardTitle>
                <CardDescription>Distribution of task priorities</CardDescription>
              </CardHeader>
              <CardContent>
                {priorityBreakdown.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No tasks yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={priorityBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {priorityBreakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Category Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryBreakdown.map(({ name, value }) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{value} tasks</span>
                    </div>
                    <Progress
                      value={(value / tasks.length) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Learning tab */}
        <TabsContent value="learning" className="mt-4 space-y-4">
          {skills.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Track skills to see learning analytics</p>
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-yellow-400" /> Skill Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {skillProgress.map((s) => (
                    <div key={s.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">Lv.{s.level} · {s.xp} XP</span>
                      </div>
                      <Progress value={s.progress} className="h-2.5" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.progress}% complete</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">XP Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={skillProgress}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="xp" name="XP" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Wellness tab */}
        <TabsContent value="wellness" className="mt-4 space-y-4">
          {journals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Smile className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Write journal entries to see mood analytics</p>
            </div>
          ) : (
            <>
              {moodByDay.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Smile className="w-4 h-4 text-green-400" /> Mood Trend (Last 7 Days)
                    </CardTitle>
                    <CardDescription>1 = awful, 5 = great</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={moodByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(v: number) => [`${v} / 5`, "Mood score"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ fill: "#22c55e", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(["great", "good", "neutral", "bad", "awful"] as const).map((mood) => {
                  const count = journals.filter((j) => j.mood === mood).length;
                  const pct = journals.length ? Math.round((count / journals.length) * 100) : 0;
                  return (
                    <Card key={mood}>
                      <CardContent className="p-3 text-center">
                        <div className="text-2xl mb-1">{MOOD_EMOJI[mood]}</div>
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{mood}</p>
                        <p className="text-[10px] text-muted-foreground">{pct}%</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
