"use client";

import { useState, useMemo } from "react";
import {
  Plus, Search, CheckCircle2, Circle, Clock,
  Trash2, Edit2, Flame, Calendar, Brain, Filter,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Task, Priority, Recurrence } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, isToday, formatDate } from "@/lib/utils";

const PRIORITY_OPTIONS: Priority[] = ["low", "medium", "high", "critical"];

const PRIORITY_STYLES: Record<Priority, { dot: string; badge: string }> = {
  low:      { dot: "bg-blue-400",   badge: "bg-blue-500/10 text-blue-400 border-blue-500/20"     },
  medium:   { dot: "bg-yellow-400", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  high:     { dot: "bg-orange-400", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  critical: { dot: "bg-red-400",    badge: "bg-red-500/10 text-red-400 border-red-500/20"         },
};

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "none",     label: "Does not repeat"  },
  { value: "daily",    label: "Every day"         },
  { value: "weekdays", label: "Weekdays (Mon–Fri)" },
  { value: "weekly",   label: "Every week"        },
  { value: "monthly",  label: "Every month"       },
];

interface TaskFormData {
  title: string; description: string; priority: Priority;
  dueDate: string; dueTime: string; category: string;
  reminder: boolean; recurrence: Recurrence;
}
const DEFAULT_FORM: TaskFormData = {
  title: "", description: "", priority: "medium",
  dueDate: "", dueTime: "", category: "", reminder: false, recurrence: "none",
};

export default function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask, completeTask, toggleThoughtsPanel, notificationsEnabled, setNotificationsEnabled } = useAppStore();
  const [search,         setSearch]         = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [dialogOpen,     setDialogOpen]     = useState(false);
  const [editId,         setEditId]         = useState<string | null>(null);
  const [form,           setForm]           = useState<TaskFormData>(DEFAULT_FORM);

  const filtered = useMemo(() =>
    tasks.filter((t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (filterPriority === "all" || t.priority === filterPriority)
    ),
    [tasks, search, filterPriority]
  );

  const todayTasks    = filtered.filter((t) => t.dueDate && isToday(t.dueDate) && t.status !== "done");
  const upcomingTasks = filtered.filter((t) => (!t.dueDate || !isToday(t.dueDate)) && t.status !== "done");
  const doneTasks     = filtered.filter((t) => t.status === "done");

  function openCreate() { setEditId(null); setForm(DEFAULT_FORM); setDialogOpen(true); }
  function openEdit(task: Task) {
    setEditId(task.id);
    setForm({
      title: task.title, description: task.description ?? "", priority: task.priority,
      dueDate: task.dueDate ?? "", dueTime: task.dueTime ?? "",
      category: task.category ?? "", reminder: task.reminder ?? false,
      recurrence: task.recurrence ?? "none",
    });
    setDialogOpen(true);
  }

  function scheduleNotification(title: string, dueDate: string, dueTime: string) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") setNotificationsEnabled(true);
      });
      return;
    }
    const dt = new Date(`${dueDate}T${dueTime}`);
    const delay = dt.getTime() - Date.now();
    if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) { // within 7 days
      setTimeout(() => {
        new Notification(`⏰ Reminder: ${title}`, {
          body: `This task is due now!`,
          icon: "/icon",
          badge: "/icon",
        });
      }, delay);
    }
  }

  function handleSave() {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title, description: form.description, priority: form.priority,
      dueDate: form.dueDate || undefined, dueTime: form.dueTime || undefined,
      category: form.category || undefined, reminder: form.reminder,
      recurrence: form.recurrence !== "none" ? form.recurrence : undefined,
    };
    if (editId) updateTask(editId, payload);
    else addTask({ ...payload, status: "todo" });
    // Schedule a local notification if reminder + time set
    if (form.reminder && form.dueDate && form.dueTime) {
      scheduleNotification(form.title, form.dueDate, form.dueTime);
    }
    setDialogOpen(false);
  }

  function toggleDone(task: Task) {
    if (task.status === "done") updateTask(task.id, { status: "todo" });
    else completeTask(task.id); // handles recurring spawn
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
          title="Task Manager"
          subtitle={`${stats.done}/${stats.total} completed · ${stats.today} due today`}
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleThoughtsPanel} className="gap-1.5 rounded-xl">
                <Brain className="w-3.5 h-3.5" /> AI
              </Button>
              <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-xl">
                <Plus className="w-3.5 h-3.5" /> New task
              </Button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
          <StatCard label="Total"    value={stats.total}    icon={Circle}        iconColor="text-muted-foreground" />
          <StatCard label="Done"     value={stats.done}     icon={CheckCircle2}  iconColor="text-green-400" />
          <StatCard label="Today"    value={stats.today}    icon={Flame}         iconColor="text-orange-400" />
          <StatCard label="Critical" value={stats.critical} icon={CheckCircle2}  iconColor="text-red-400" />
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tasks…" className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as Priority | "all")}>
            <SelectTrigger className="w-[150px] rounded-xl gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="today">
          <TabsList className="rounded-xl">
            <TabsTrigger value="today" className="rounded-lg gap-1.5">
              Today <span className="text-[10px] bg-orange-500/20 text-orange-400 rounded-md px-1.5">{todayTasks.length}</span>
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-lg gap-1.5">
              Upcoming <span className="text-[10px] bg-muted rounded-md px-1.5">{upcomingTasks.length}</span>
            </TabsTrigger>
            <TabsTrigger value="done" className="rounded-lg gap-1.5">
              Done <span className="text-[10px] bg-green-500/20 text-green-400 rounded-md px-1.5">{doneTasks.length}</span>
            </TabsTrigger>
          </TabsList>

          {[
            { value: "today",    list: todayTasks,    empty: "No tasks due today — enjoy your day!" },
            { value: "upcoming", list: upcomingTasks, empty: "No upcoming tasks. Plan your week ahead." },
            { value: "done",     list: doneTasks,     empty: "Nothing completed yet. Let's get going!" },
          ].map(({ value, list, empty }) => (
            <TabsContent key={value} value={value} className="mt-4 space-y-2">
              {list.length === 0 ? (
                <EmptyState icon={CheckCircle2} title={empty} className="py-12" />
              ) : (
                list.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => toggleDone(task)}
                    onEdit={() => openEdit(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))
              )}
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
                <Input placeholder="What needs to be done?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                <Textarea placeholder="Add more details…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="resize-none h-20 rounded-xl" />
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
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                  <Input placeholder="Work, Personal…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl" />
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
            </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Repeat</label>
                <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as Recurrence })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.reminder}
                  onChange={(e) => setForm({ ...form, reminder: e.target.checked })}
                  className="rounded"
                />
                Set reminder notification
              </label>
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

function TaskRow({ task, onToggle, onEdit, onDelete }: {
  task: Task; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const done = task.status === "done";
  const style = PRIORITY_STYLES[task.priority];
  return (
    <div className={cn(
      "group flex items-start gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:border-border/60 transition-all",
      done && "opacity-50"
    )}>
      <button onClick={onToggle} className="mt-0.5 shrink-0 touch-target rounded-lg text-muted-foreground hover:text-primary transition-colors">
        {done ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Circle className="w-5 h-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", done && "line-through text-muted-foreground")}>{task.title}</p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border capitalize font-medium", style.badge)}>
            {task.priority}
          </span>
          {task.dueDate && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {formatDate(task.dueDate)}{task.dueTime && ` · ${task.dueTime}`}
            </span>
          )}
          {task.category && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{task.category}</span>
          )}
          {task.recurrence && task.recurrence !== "none" && (
            <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md capitalize">↺ {task.recurrence}</span>
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
