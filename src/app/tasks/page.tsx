"use client";

import { useState, useMemo, useRef } from "react";
import {
  Plus, Search, CheckCircle2, Circle, Clock,
  Trash2, Edit2, Flame, Calendar, Brain, Filter,
  MapPin, Repeat, Bell, BellOff, Loader2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Task, Priority, Recurrence, Location } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, isToday, formatDate } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "@/hooks/useToast";

const PRIORITY_OPTIONS: Priority[]       = ["low", "medium", "high", "critical"];
const RECURRENCE_OPTIONS: Recurrence[]   = ["none", "daily", "weekdays", "weekly", "monthly"];

const PRIORITY_STYLES: Record<Priority, { dot: string; badge: string }> = {
  low:      { dot: "bg-blue-400",   badge: "bg-blue-500/10 text-blue-400 border-blue-500/20"     },
  medium:   { dot: "bg-yellow-400", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  high:     { dot: "bg-orange-400", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  critical: { dot: "bg-red-400",    badge: "bg-red-500/10 text-red-400 border-red-500/20"         },
};

interface TaskFormData {
  title: string; description: string; priority: Priority; recurrence: Recurrence;
  dueDate: string; dueTime: string; category: string; reminder: boolean;
  location: Location | null;
}
const DEFAULT_FORM: TaskFormData = {
  title: "", description: "", priority: "medium", recurrence: "none",
  dueDate: "", dueTime: "", category: "", reminder: false, location: null,
};

export default function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask, completeTask, toggleThoughtsPanel } = useAppStore();
  const { notificationsEnabled, requestPermission, scheduleReminder } = useNotifications();
  const { loading: geoLoading, getLocation, openInMaps } = useGeolocation();

  const [search,         setSearch]     = useState("");
  const [filterPriority, setFilter]     = useState<Priority | "all">("all");
  const [dialogOpen,     setDialogOpen] = useState(false);
  const [editId,         setEditId]     = useState<string | null>(null);
  const [form,           setForm]       = useState<TaskFormData>(DEFAULT_FORM);

  const filtered = useMemo(() =>
    tasks.filter((t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (filterPriority === "all" || t.priority === filterPriority)
    ), [tasks, search, filterPriority]);

  const todayTasks    = filtered.filter((t) => t.dueDate && isToday(t.dueDate) && t.status !== "done");
  const upcomingTasks = filtered.filter((t) => (!t.dueDate || !isToday(t.dueDate)) && t.status !== "done");
  const doneTasks     = filtered.filter((t) => t.status === "done");

  function openCreate() { setEditId(null); setForm(DEFAULT_FORM); setDialogOpen(true); }
  function openEdit(task: Task) {
    setEditId(task.id);
    setForm({
      title: task.title, description: task.description ?? "", priority: task.priority,
      recurrence: task.recurrence ?? "none",
      dueDate: task.dueDate ?? "", dueTime: task.dueTime ?? "",
      category: task.category ?? "", reminder: task.reminder ?? false,
      location: task.location ?? null,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title, description: form.description, priority: form.priority,
      recurrence: form.recurrence !== "none" ? form.recurrence : undefined,
      dueDate: form.dueDate || undefined, dueTime: form.dueTime || undefined,
      category: form.category || undefined, reminder: form.reminder,
      location: form.location ?? undefined,
    };
    if (editId) {
      updateTask(editId, payload);
    } else {
      const task = addTask({ ...payload, status: "todo" });
      if (form.reminder && form.dueDate && form.dueTime) {
        if (!notificationsEnabled) await requestPermission();
        scheduleReminder(task.title, task.dueDate!, task.dueTime!);
      }
    }
    setDialogOpen(false);
  }

  async function handleLocationPick() {
    const loc = await getLocation();
    if (loc) setForm((f) => ({ ...f, location: loc }));
  }

  const stats = {
    total:    tasks.length,
    done:     tasks.filter((t) => t.status === "done").length,
    today:    tasks.filter((t) => t.dueDate && isToday(t.dueDate) && t.status !== "done").length,
    critical: tasks.filter((t) => t.priority === "critical" && t.status !== "done").length,
  };

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-4 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-5 page-enter">
        <PageHeader
          title="Tasks"
          subtitle={`${stats.done}/${stats.total} done · ${stats.today} due today`}
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleThoughtsPanel} className="gap-1.5 rounded-xl">
                <Brain className="w-3.5 h-3.5" /> AI
              </Button>
              <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-xl">
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
            </div>
          }
        />

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total",    value: stats.total,    color: "text-muted-foreground" },
            { label: "Done",     value: stats.done,     color: "text-green-400"        },
            { label: "Today",    value: stats.today,    color: "text-orange-400"       },
            { label: "Critical", value: stats.critical, color: "text-red-400"          },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-3 rounded-2xl bg-card border border-border">
              <p className={cn("text-xl font-bold", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tasks…" className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterPriority} onValueChange={(v) => setFilter(v as Priority | "all")}>
            <SelectTrigger className="w-[130px] rounded-xl gap-1.5">
              <Filter className="w-3.5 h-3.5" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="today">
          <TabsList className="rounded-xl w-full">
            <TabsTrigger value="today" className="flex-1 rounded-lg gap-1.5">
              Today <span className="text-[10px] bg-orange-500/20 text-orange-400 rounded-md px-1.5">{todayTasks.length}</span>
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1 rounded-lg gap-1.5">
              Upcoming <span className="text-[10px] bg-muted rounded-md px-1.5">{upcomingTasks.length}</span>
            </TabsTrigger>
            <TabsTrigger value="done" className="flex-1 rounded-lg gap-1.5">
              Done <span className="text-[10px] bg-green-500/20 text-green-400 rounded-md px-1.5">{doneTasks.length}</span>
            </TabsTrigger>
          </TabsList>

          {[
            { value: "today",    list: todayTasks,    empty: "No tasks due today — enjoy your day!" },
            { value: "upcoming", list: upcomingTasks, empty: "No upcoming tasks. Plan ahead." },
            { value: "done",     list: doneTasks,     empty: "Nothing completed yet. Let's go!" },
          ].map(({ value, list, empty }) => (
            <TabsContent key={value} value={value} className="mt-3 space-y-2">
              {list.length === 0 ? (
                <EmptyState icon={CheckCircle2} title={empty} className="py-12" />
              ) : list.map((task) => (
                <TaskRow
                  key={task.id} task={task}
                  onToggle={() => completeTask(task.id)}
                  onEdit={() => openEdit(task)}
                  onDelete={() => deleteTask(task.id)}
                  onMapOpen={(loc) => openInMaps(loc)}
                />
              ))}
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit task" : "New task"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title *</label>
                <Input placeholder="What needs to be done?" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                <Textarea placeholder="Add details…" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none h-20 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1"><Repeat className="w-3 h-3" /> Repeat</label>
                  <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as Recurrence })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r === "none" ? "No repeat" : r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due date</label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due time</label>
                  <Input type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                  <Input placeholder="Work, Personal…" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</label>
                  <Button
                    type="button" variant="outline" size="sm" className="w-full rounded-xl gap-1.5 justify-start"
                    onClick={handleLocationPick} disabled={geoLoading}
                  >
                    {geoLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Getting…</>
                      : form.location
                        ? <><MapPin className="w-3.5 h-3.5 text-green-400" /> Location set</>
                        : <><MapPin className="w-3.5 h-3.5" /> Add location</>
                    }
                  </Button>
                </div>
              </div>
              {/* Reminder toggle */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted/40 transition-colors">
                <input type="checkbox" className="w-4 h-4 rounded accent-primary"
                  checked={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.checked })} />
                <div className="flex items-center gap-2">
                  {form.reminder ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm font-medium">{form.reminder ? "Reminder on" : "Set reminder"}</span>
                </div>
                {form.reminder && !form.dueTime && (
                  <span className="text-[10px] text-muted-foreground ml-auto">Set a due time too</span>
                )}
              </label>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={handleSave} disabled={!form.title.trim()}>
                {editId ? "Save changes" : "Create task"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onEdit, onDelete, onMapOpen }: {
  task: Task;
  onToggle: () => void;
  onEdit:   () => void;
  onDelete: () => void;
  onMapOpen: (loc: NonNullable<Task["location"]>) => void;
}) {
  const done  = task.status === "done";
  const style = PRIORITY_STYLES[task.priority];
  return (
    <div className={cn(
      "group flex items-start gap-3 px-4 py-3.5 rounded-2xl border border-border bg-card transition-all",
      done && "opacity-50",
    )}>
      <button onClick={onToggle} className="mt-0.5 shrink-0 touch-target -ml-1 text-muted-foreground hover:text-primary transition-colors">
        {done ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Circle className="w-5 h-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", done && "line-through text-muted-foreground")}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border capitalize font-medium", style.badge)}>{task.priority}</span>
          {task.dueDate && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" /> {formatDate(task.dueDate)}{task.dueTime && ` · ${task.dueTime}`}
            </span>
          )}
          {task.recurrence && task.recurrence !== "none" && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Repeat className="w-2.5 h-2.5" /> {task.recurrence}
            </span>
          )}
          {task.reminder && <Bell className="w-3 h-3 text-muted-foreground" />}
          {task.location && (
            <button
              onClick={() => onMapOpen(task.location!)}
              className="text-[10px] text-green-400 flex items-center gap-1 hover:underline"
            >
              <MapPin className="w-2.5 h-2.5" /> Map
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onEdit}><Edit2 className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}
