"use client";

import { useState, useMemo } from "react";
import { Plus, Flame, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Habit, HabitFrequency } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { format, subDays, eachDayOfInterval } from "date-fns";

// ── constants ──────────────────────────────────────────────────────────────────
const EMOJIS  = ["🔥","💪","📚","🧘","💧","🏃","✍️","🎯","😴","🥗","🧠","🎨"];
const COLORS: Record<string, { bg: string; ring: string; dot: string }> = {
  green:  { bg: "bg-green-500/15",  ring: "ring-green-500/40",  dot: "bg-green-400"  },
  blue:   { bg: "bg-blue-500/15",   ring: "ring-blue-500/40",   dot: "bg-blue-400"   },
  orange: { bg: "bg-orange-500/15", ring: "ring-orange-500/40", dot: "bg-orange-400" },
  purple: { bg: "bg-purple-500/15", ring: "ring-purple-500/40", dot: "bg-purple-400" },
  red:    { bg: "bg-red-500/15",    ring: "ring-red-500/40",    dot: "bg-red-400"    },
  yellow: { bg: "bg-yellow-500/15", ring: "ring-yellow-500/40", dot: "bg-yellow-400" },
};
const COLOR_KEYS = Object.keys(COLORS) as (keyof typeof COLORS)[];

const FREQ_LABELS: Record<HabitFrequency, string> = {
  daily:    "Every day",
  weekdays: "Weekdays (Mon–Fri)",
  weekends: "Weekends (Sat–Sun)",
  weekly:   "Once a week",
};

// ── heatmap (last 10 weeks) ────────────────────────────────────────────────────
function HeatMap({ habitId }: { habitId: string }) {
  const { habitLogs } = useAppStore();
  const done = useMemo(
    () => new Set(habitLogs.filter((l) => l.habitId === habitId).map((l) => l.date)),
    [habitLogs, habitId]
  );
  const days = useMemo(
    () => eachDayOfInterval({ start: subDays(new Date(), 69), end: new Date() }),
    []
  );
  return (
    <div className="flex gap-0.5 flex-wrap mt-2">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        return (
          <div
            key={key}
            title={key}
            className={cn(
              "w-3 h-3 rounded-sm transition-colors",
              done.has(key) ? "bg-green-400" : "bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function HabitsPage() {
  const { habits, habitLogs, addHabit, deleteHabit, toggleHabitLog, getHabitStreak, isHabitDone } = useAppStore();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "🔥", color: "green", frequency: "daily" as HabitFrequency });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const doneToday = habits.filter((h) => isHabitDone(h.id, todayStr)).length;

  function handleAdd() {
    if (!form.name.trim()) return;
    addHabit({ name: form.name.trim(), emoji: form.emoji, color: form.color, frequency: form.frequency });
    setForm({ name: "", emoji: "🔥", color: "green", frequency: "daily" });
    setOpen(false);
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-4 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-5 page-enter">
        <PageHeader
          title="Habits"
          subtitle={`${doneToday}/${habits.length} done today`}
          action={
            <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5 rounded-xl">
              <Plus className="w-3.5 h-3.5" /> New habit
            </Button>
          }
        />

        {habits.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="No habits yet"
            description="Build consistent routines. Track daily, weekday, or weekly habits and watch your streaks grow."
            action={
              <Button onClick={() => setOpen(true)} variant="outline" className="gap-1.5 rounded-xl">
                <Plus className="w-3.5 h-3.5" /> Add your first habit
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => {
              const done   = isHabitDone(habit.id, todayStr);
              const streak = getHabitStreak(habit.id);
              const c      = COLORS[habit.color] ?? COLORS.green;

              return (
                <Card key={habit.id} className={cn("transition-all", done && c.bg)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Check button */}
                      <button
                        onClick={() => toggleHabitLog(habit.id, todayStr)}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
                          done ? cn("ring-2", c.ring, c.bg) : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {done
                          ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                          : <Circle       className="w-5 h-5 text-muted-foreground" />
                        }
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg leading-none">{habit.emoji}</span>
                          <p className={cn("text-sm font-semibold", done && "line-through text-muted-foreground")}>
                            {habit.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-muted-foreground">{FREQ_LABELS[habit.frequency]}</p>
                          {streak > 0 && (
                            <span className="flex items-center gap-0.5 text-xs font-semibold text-orange-400">
                              <Flame className="w-3 h-3" /> {streak}d
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => deleteHabit(habit.id)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Heatmap */}
                    <HeatMap habitId={habit.id} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>New habit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                <Input
                  placeholder="e.g. Morning run, Read 20 min…"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="rounded-xl"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setForm({ ...form, emoji: e })}
                      className={cn(
                        "w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all",
                        form.emoji === e ? "bg-primary/10 ring-2 ring-primary scale-110" : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Colour</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_KEYS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, color: c })}
                        className={cn(
                          "w-6 h-6 rounded-full transition-all",
                          COLORS[c].dot,
                          form.color === c && "ring-2 ring-offset-2 ring-foreground/30 scale-125"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequency</label>
                  <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as HabitFrequency })}>
                    <SelectTrigger className="rounded-xl text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(FREQ_LABELS) as [HabitFrequency, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={handleAdd} disabled={!form.name.trim()}>
                <Flame className="w-3.5 h-3.5 mr-1.5" /> Add habit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
