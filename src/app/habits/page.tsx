"use client";

import { useState } from "react";
import { Plus, Trash2, Flame, Target, Check, X } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Habit } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";

const ICON_OPTIONS = ["💧", "📖", "🏃", "🧘", "💤", "🥗", "🧠", "🎨", "💪", "🎵", "☀️", "🌱"];

// Compute streak: how many days back from today did the habit have a check-in?
function habitStreak(habit: Habit): number {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const key = format(subDays(new Date(), i), "yyyy-MM-dd");
    if (habit.completedDates[key]) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function completedThisWeek(habit: Habit): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const key = format(subDays(new Date(), i), "yyyy-MM-dd");
    if (habit.completedDates[key]) n++;
  }
  return n;
}

export default function HabitsPage() {
  const { habits, addHabit, deleteHabit, toggleHabitDate } = useAppStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💧");

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { date: format(d, "yyyy-MM-dd"), label: format(d, "EEE")[0], dayNum: format(d, "d") };
  });

  function handleAdd() {
    if (!name.trim()) return;
    addHabit({ name: name.trim(), icon });
    setName("");
    setIcon("💧");
    setDialogOpen(false);
    toast.success(`Habit "${name.trim()}" added`);
  }

  function handleToggle(habit: Habit, date: string) {
    toggleHabitDate(habit.id, date);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(40);
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-5 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-6 page-enter max-w-2xl mx-auto">
        <PageHeader
          title="Habits"
          subtitle="Small repeated wins compound."
          action={
            <Button onClick={() => setDialogOpen(true)} className="rounded-xl gap-1.5" size="sm">
              <Plus className="w-4 h-4" /> New habit
            </Button>
          }
        />

        {habits.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No habits yet"
            description="Pick something small and consistent — drink water, read 10 pages, take a walk. Compounding starts now."
            action={
              <Button onClick={() => setDialogOpen(true)} className="rounded-xl gap-1.5">
                <Plus className="w-4 h-4" /> Create your first habit
              </Button>
            }
            secondaryHint="Tip: start with one habit. Stack a second one only after 14 days of consistency."
          />
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => {
              const streak = habitStreak(habit);
              const thisWeek = completedThisWeek(habit);
              const doneToday = !!habit.completedDates[todayStr];

              return (
                <Card key={habit.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-muted/60 flex items-center justify-center text-xl shrink-0">
                          {habit.icon ?? "✨"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{habit.name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Flame className="w-3 h-3 text-orange-400" /> {streak}d streak
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {thisWeek}/7 this week
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => { deleteHabit(habit.id); toast.info("Habit removed"); }}
                        className="w-8 h-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors shrink-0"
                        aria-label="Delete habit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 7-day grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {last7.map(({ date, label, dayNum }) => {
                        const isToday = date === todayStr;
                        const done = !!habit.completedDates[date];
                        return (
                          <button
                            key={date}
                            onClick={() => handleToggle(habit, date)}
                            className={cn(
                              "aspect-square rounded-xl flex flex-col items-center justify-center transition-all active:scale-95",
                              done
                                ? "bg-primary/20 border border-primary/40 text-primary"
                                : "bg-muted/40 border border-border/40 text-muted-foreground hover:bg-muted/70",
                              isToday && !done && "ring-1 ring-primary/40",
                            )}
                          >
                            <span className="text-[9px] font-semibold uppercase opacity-70">{label}</span>
                            <span className="text-xs font-bold tabular-nums">{dayNum}</span>
                            {done && <Check className="w-3 h-3 mt-0.5" strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Today's quick toggle (large CTA) */}
                    {!doneToday && (
                      <Button
                        onClick={() => handleToggle(habit, todayStr)}
                        className="w-full mt-3 rounded-xl gap-1.5"
                        size="sm"
                        variant="outline"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark done for today
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create-habit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>New habit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                <Input
                  placeholder="Drink water, Read 20 min…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  className="rounded-xl"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {ICON_OPTIONS.map((emo) => (
                    <button
                      key={emo}
                      onClick={() => setIcon(emo)}
                      className={cn(
                        "aspect-square rounded-xl border text-xl transition-all active:scale-95",
                        icon === emo
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                <X className="w-4 h-4 mr-1.5" /> Cancel
              </Button>
              <Button className="rounded-xl" onClick={handleAdd} disabled={!name.trim()}>
                <Plus className="w-4 h-4 mr-1.5" /> Add habit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
