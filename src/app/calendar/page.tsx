"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalIcon,
  Clock, Trash2, Brain, X,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  addWeeks, subWeeks, startOfWeek as startOfWeekFn,
  isToday as dateFnsIsToday,
} from "date-fns";
import { useAppStore } from "@/store/useAppStore";
import { CalendarEvent, EventType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const EVENT_COLORS: Record<EventType, string> = {
  task: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  meeting: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  reminder: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  personal: "bg-green-500/20 text-green-400 border-green-500/30",
  study: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const EVENT_DOT: Record<EventType, string> = {
  task: "bg-blue-400", meeting: "bg-purple-400", reminder: "bg-yellow-400",
  personal: "bg-green-400", study: "bg-orange-400",
};

interface EventForm {
  title: string;
  description: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  reminder: boolean;
}

const DEFAULT_FORM: EventForm = {
  title: "", description: "", type: "personal",
  date: format(new Date(), "yyyy-MM-dd"),
  startTime: "", endTime: "", allDay: false, reminder: false,
};

export default function CalendarPage() {
  const { events, addEvent, deleteEvent, tasks, toggleThoughtsPanel } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(DEFAULT_FORM);
  const [view,        setView]        = useState<"month" | "week" | "agenda">("month");
  const [weekStart,   setWeekStart]   = useState(() => startOfWeekFn(new Date(), { weekStartsOn: 1 }));

  // Open create dialog from ?new=1 (keyboard shortcut E)
  const searchParams = useSearchParams();
  const router       = useRouter();
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setForm(DEFAULT_FORM); setDialogOpen(true);
      router.replace("/calendar");
    }
  }, [searchParams, router]);

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      (map[e.date] ??= []).push(e);
    });
    return map;
  }, [events]);

  const taskEventDates = useMemo(() => {
    const s = new Set<string>();
    tasks
      .filter((t) => t.dueDate && t.status !== "done")
      .forEach((t) => s.add(t.dueDate!));
    return s;
  }, [tasks]);

  const dayEvents = selectedDay
    ? (eventsMap[format(selectedDay, "yyyy-MM-dd")] ?? [])
    : [];

  const allUpcoming = [...events]
    .filter((e) => e.date >= format(new Date(), "yyyy-MM-dd"))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  function openCreate(day?: Date) {
    setForm({
      ...DEFAULT_FORM,
      date: day ? format(day, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    addEvent({
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      date: form.date,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      allDay: form.allDay,
      reminder: form.reminder,
    });
    setDialogOpen(false);
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-5 page-enter">
      <PageHeader
        title="Calendar"
        subtitle={`${events.length} events · ${tasks.filter((t) => t.dueDate).length} tasks with dates`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleThoughtsPanel} className="gap-1.5 rounded-xl">
              <Brain className="w-3.5 h-3.5" /> AI
            </Button>
            <Button onClick={() => openCreate()} size="sm" className="gap-1.5 rounded-xl">
              <Plus className="w-3.5 h-3.5" /> New event
            </Button>
          </div>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as "month" | "agenda")}>
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar grid */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
                        Today
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {calDays.map((day) => {
                      const key = format(day, "yyyy-MM-dd");
                      const dayEvs = eventsMap[key] ?? [];
                      const hasTask = taskEventDates.has(key);
                      const isSelected = selectedDay && isSameDay(day, selectedDay);
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isToday = dateFnsIsToday(day);
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedDay(isSameDay(day, selectedDay!) ? null : day)}
                          onDoubleClick={() => openCreate(day)}
                          className={cn(
                            "relative min-h-[60px] p-1 rounded-lg text-left transition-colors",
                            !isCurrentMonth && "opacity-30",
                            isSelected && "bg-primary/10 ring-1 ring-primary",
                            !isSelected && isCurrentMonth && "hover:bg-muted/50",
                            isToday && !isSelected && "ring-1 ring-primary/50"
                          )}
                        >
                          <span className={cn(
                            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                            isToday && "bg-primary text-primary-foreground"
                          )}>
                            {format(day, "d")}
                          </span>
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {dayEvs.slice(0, 2).map((e) => (
                              <div
                                key={e.id}
                                className={cn("w-full text-[9px] px-1 py-0.5 rounded truncate border", EVENT_COLORS[e.type])}
                              >
                                {e.title}
                              </div>
                            ))}
                            {dayEvs.length > 2 && (
                              <div className="text-[9px] text-muted-foreground">+{dayEvs.length - 2}</div>
                            )}
                            {hasTask && dayEvs.length === 0 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Day panel */}
            <div>
              <Card className="md:sticky md:top-6">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Select a day"}
                    </CardTitle>
                    {selectedDay && (
                      <Button size="sm" variant="ghost" onClick={() => openCreate(selectedDay)} className="gap-1 text-xs">
                        <Plus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!selectedDay ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Click a day to see events
                    </p>
                  ) : dayEvents.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CalIcon className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No events this day</p>
                      <Button size="sm" variant="outline" className="mt-2 text-xs gap-1" onClick={() => openCreate(selectedDay)}>
                        <Plus className="w-3 h-3" /> Add event
                      </Button>
                    </div>
                  ) : (
                    dayEvents.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")).map((e) => (
                      <div key={e.id} className={cn("flex items-start gap-2 p-2.5 rounded-lg border", EVENT_COLORS[e.type])}>
                        <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", EVENT_DOT[e.type])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{e.title}</p>
                          {e.startTime && (
                            <p className="text-[10px] opacity-70">
                              <Clock className="w-3 h-3 inline mr-0.5" />
                              {e.startTime}{e.endTime ? ` – ${e.endTime}` : ""}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteEvent(e.id)}
                          className="opacity-60 hover:opacity-100 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Week view ── */}
        <TabsContent value="week" className="mt-4">
          {(() => {
            const weekDays = eachDayOfInterval({ start: weekStart, end: addWeeks(weekStart, 1) }).slice(0, 7);
            const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am–9pm
            return (
              <div className="space-y-3">
                {/* Nav */}
                <div className="flex items-center justify-between">
                  <button onClick={() => setWeekStart((w) => subWeeks(w, 1))}
                    className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-semibold">
                    {format(weekStart, "MMM d")} – {format(addWeeks(weekStart, 1), "MMM d, yyyy")}
                  </p>
                  <button onClick={() => setWeekStart((w) => addWeeks(w, 1))}
                    className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <div className="min-w-[480px]">
                    {/* Day headers */}
                    <div className="grid border-b border-border bg-muted/30" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                      <div className="py-2" />
                      {weekDays.map((d) => (
                        <div key={d.toISOString()} className={cn(
                          "py-2 text-center text-[10px] font-semibold border-l border-border",
                          dateFnsIsToday(d) && "text-primary"
                        )}>
                          <p className="text-muted-foreground">{format(d, "EEE")}</p>
                          <p className={cn("text-sm font-bold mt-0.5", dateFnsIsToday(d) && "w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-xs")}>
                            {format(d, "d")}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Time slots */}
                    {HOURS.map((hour) => (
                      <div key={hour} className="grid border-b border-border/50" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                        <div className="py-2 px-1.5 text-[10px] text-muted-foreground text-right leading-none pt-1">
                          {hour === 12 ? "12pm" : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
                        </div>
                        {weekDays.map((d) => {
                          const key = format(d, "yyyy-MM-dd");
                          const slotEvents = events.filter((e) => {
                            if (e.date !== key) return false;
                            if (!e.startTime) return false;
                            return parseInt(e.startTime.split(":")[0]) === hour;
                          });
                          return (
                            <div key={d.toISOString()} className="border-l border-border/50 min-h-[40px] p-0.5 relative hover:bg-muted/20 transition-colors cursor-pointer"
                              onDoubleClick={() => { openCreate(d); }}>
                              {slotEvents.map((ev) => (
                                <div key={ev.id} className={cn(
                                  "text-[10px] font-medium px-1.5 py-1 rounded-md truncate mb-0.5 border",
                                  EVENT_COLORS[ev.type]
                                )}>
                                  {ev.startTime} {ev.title}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Double-tap any slot to add an event</p>
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="agenda" className="mt-4 space-y-3">
          {allUpcoming.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No upcoming events</p>
            </div>
          ) : (
            allUpcoming.map((e) => (
              <div key={e.id} className={cn("flex items-start gap-3 p-4 rounded-xl border", EVENT_COLORS[e.type])}>
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", EVENT_DOT[e.type])} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{e.title}</p>
                    <button onClick={() => deleteEvent(e.id)} className="opacity-60 hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs opacity-70">
                    <span>{format(new Date(e.date), "MMM d, yyyy")}</span>
                    {e.startTime && <span><Clock className="w-3 h-3 inline mr-0.5" />{e.startTime}</span>}
                    <span className="capitalize">{e.type}</span>
                  </div>
                  {e.description && <p className="text-xs mt-1 opacity-70">{e.description}</p>}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Event title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as EventType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["task", "meeting", "reminder", "personal", "study"] as EventType[]).map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start time</label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">End time</label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <Input
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.checked })} />
              <span className="text-sm">Set reminder</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>Add event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
