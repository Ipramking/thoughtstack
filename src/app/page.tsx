"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Sparkles, ArrowRight, Plus, CheckCircle2,
  Circle, Flame, BookOpen, Calendar, Loader2, Brain, Repeat, Zap,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { callThoughts } from "@/lib/thoughts-ai";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ThoughtsAction, ThoughtsContext } from "@/types";
import { cn, isToday, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { format } from "date-fns";

const PRIORITY_DOT: Record<string, string> = {
  low:      "bg-blue-400",
  medium:   "bg-yellow-400",
  high:     "bg-orange-400",
  critical: "bg-red-400",
};

const MOOD_EMOJI: Record<string, string> = {
  great: "😄", good: "🙂", neutral: "😐", bad: "😕", awful: "😞",
};

const GREET = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

export default function HomePage() {
  const { tasks, journals, events, profile, addTask, addEvent, completeTask, toggleThoughtsPanel, getStreak } = useAppStore();
  const isOnline = useOnlineStatus();

  const [capture, setCapture]   = useState("");
  const [aiLoading, setAiLoad]  = useState(false);
  const [aiResult, setAiResult] = useState<{ reply: string; actions: ThoughtsAction[] } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const todayStr    = format(new Date(), "yyyy-MM-dd");
  const todayTasks  = useMemo(() => tasks.filter((t) => t.status !== "done" && (!t.dueDate || isToday(t.dueDate))), [tasks]);
  const todayEvents = useMemo(() => events.filter((e) => e.date === todayStr).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")), [events, todayStr]);
  const recentEntry = journals[0];
  const firstName   = profile.name?.split(" ")[0] || "there";
  const streak      = getStreak();

  const context = useMemo((): ThoughtsContext => ({
    todayTasks: todayTasks.slice(0, 8).map((t) => ({ title: t.title, priority: t.priority, status: t.status, dueTime: t.dueTime })),
    todayEvents: todayEvents.slice(0, 5).map((e) => ({ title: e.title, startTime: e.startTime, type: e.type })),
    recentJournals: journals.slice(0, 3).map((j) => ({ title: j.title, mood: j.mood, date: j.createdAt.split("T")[0] })),
    stats: { tasksTotal: tasks.length, tasksDone: tasks.filter((t) => t.status === "done").length, journalCount: journals.length, streak },
  }), [todayTasks, todayEvents, journals, tasks, streak]);

  async function handleCapture() {
    const text = capture.trim();
    if (!text || aiLoading) return;
    setAiLoad(true);
    setAiResult(null);
    try {
      // callThoughts already falls back to local rule-based AI when offline
      const res = await callThoughts(text, [], context);
      setAiResult({ reply: res.reply, actions: res.actions ?? [] });
    } catch {
      // Shouldn't happen (callThoughts catches internally), but guard just in case
      if (!isOnline) {
        toast.info("You're offline — AI uses local mode");
        const res = await callThoughts(text, [], context);
        setAiResult({ reply: res.reply, actions: res.actions ?? [] });
      } else {
        toast.error("Couldn't reach Thoughts — try again");
      }
    } finally {
      setAiLoad(false);
    }
  }

  function applyAction(action: ThoughtsAction) {
    if (action.type === "create_task") {
      const d = action.data as { title: string; priority?: string; dueDate?: string; dueTime?: string };
      addTask({ title: d.title, priority: (d.priority as "low"|"medium"|"high"|"critical") ?? "medium", status: "todo", dueDate: d.dueDate, dueTime: d.dueTime, reminder: false });
      toast.success(`Task created: "${d.title}"`);
    } else if (action.type === "create_event") {
      const d = action.data as { title: string; date: string; startTime?: string; type?: string };
      addEvent({ title: d.title, date: d.date, startTime: d.startTime, type: (d.type as "meeting"|"task"|"reminder"|"personal"|"study") ?? "meeting", reminder: false });
      toast.success(`Added to calendar: "${d.title}"`);
    }
    setAiResult((r) => r ? { ...r, actions: r.actions.filter((a) => a !== action) } : null);
  }

  function dismissResult() {
    setAiResult(null);
    setCapture("");
    inputRef.current?.focus();
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-5 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-6 page-enter max-w-2xl mx-auto">

        {/* ── Greeting ── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{formatDate(new Date())}</p>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5">
              {GREET()}, {firstName} 👋
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold text-orange-400">{streak}d</span>
              </div>
            )}
            <button
              onClick={toggleThoughtsPanel}
              className="w-10 h-10 rounded-2xl bg-foreground flex items-center justify-center shrink-0 shadow-sm hover:opacity-90 transition-opacity active:scale-95"
            >
              <Brain className="w-5 h-5 text-background" />
            </button>
          </div>
        </div>

        {/* ── Quick Capture ── */}
        <div className="space-y-3">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={capture}
              onChange={(e) => { setCapture(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCapture(); } }}
              placeholder="What's on your mind? Thoughts will read it and act…"
              rows={2}
              disabled={aiLoading}
              className={cn(
                "w-full resize-none rounded-2xl bg-card border border-border",
                "px-4 py-3.5 pr-14 text-sm leading-relaxed placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                "transition-all scrollbar-hide disabled:opacity-60",
              )}
              style={{ minHeight: "80px" }}
            />
            <button
              onClick={handleCapture}
              disabled={!capture.trim() || aiLoading}
              className={cn(
                "absolute right-3 bottom-3 w-8 h-8 rounded-xl flex items-center justify-center",
                "bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-95",
                "disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100",
              )}
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>
          </div>

          {/* AI result card */}
          {aiResult && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-fade-up">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-lg bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-background" />
                </div>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap flex-1">{aiResult.reply}</p>
              </div>
              {aiResult.actions.length > 0 && (
                <div className="flex flex-col gap-1.5 pl-8">
                  {aiResult.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => applyAction(action)}
                      className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors flex items-center gap-2 min-h-[44px] font-medium"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={dismissResult} className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-1 font-medium">
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* ── Today's Focus ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" /> Today&apos;s Focus
            </p>
            <Link href="/tasks" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 rounded-2xl border border-dashed border-border text-center">
              <CheckCircle2 className="w-7 h-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nothing due today — great job!</p>
              <Link href="/tasks">
                <button className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add a task
                </button>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {todayTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 group">
                  <button
                    onClick={() => completeTask(task.id)}
                    className="shrink-0 touch-target -ml-1.5 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <div className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_DOT[task.priority])} />
                  <p className="flex-1 text-sm font-medium truncate">{task.title}</p>
                  {task.recurrence && task.recurrence !== "none" && (
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 flex items-center gap-0.5">
                      <Repeat className="w-2.5 h-2.5" />{task.recurrence}
                    </span>
                  )}
                  {task.dueTime && (
                    <span className="text-[11px] text-muted-foreground shrink-0">{task.dueTime}</span>
                  )}
                </div>
              ))}
              {todayTasks.length > 5 && (
                <Link href="/tasks">
                  <div className="px-4 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    +{todayTasks.length - 5} more tasks <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ── Today's Events ── */}
        {todayEvents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" /> Today&apos;s Schedule
              </p>
              <Link href="/calendar" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                Calendar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {todayEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs text-muted-foreground w-12 shrink-0 font-medium">
                    {event.startTime ?? "All day"}
                  </span>
                  <div className="w-px h-4 bg-border shrink-0" />
                  <p className="flex-1 text-sm font-medium truncate">{event.title}</p>
                  <span className="text-[10px] text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-full">{event.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Journal ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-green-400" /> Latest Journal
            </p>
            <Link href="/journal" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
              All entries <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentEntry ? (
            <Link href="/journal">
              <div className="rounded-2xl border border-border bg-card p-4 hover:bg-accent/40 transition-colors cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{MOOD_EMOJI[recentEntry.mood ?? "neutral"]}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{recentEntry.title}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(recentEntry.createdAt)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{recentEntry.content}</p>
                {recentEntry.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {recentEntry.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ) : (
            <Link href="/journal">
              <div className="flex flex-col items-center gap-2 py-8 rounded-2xl border border-dashed border-border text-center hover:bg-accent/20 transition-colors cursor-pointer">
                <BookOpen className="w-7 h-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No journal entries yet</p>
                <p className="text-xs font-medium text-primary flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Write your first entry
                </p>
              </div>
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
