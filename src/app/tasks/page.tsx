"use client";

import { useState, useMemo } from "react";
import {
  Plus, Search, Filter, CheckCircle2, Circle, Clock,
  Trash2, Edit2, AlertCircle, Flame, Calendar, Brain,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Task, Priority } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, isToday, formatDate } from "@/lib/utils";

const PRIORITY_OPTIONS: Priority[] = ["low", "medium", "high", "critical"];

const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

const PRIORITY_DOT: Record<Priority, string> = {
  low: "bg-blue-400",
  medium: "bg-yellow-400",
  high: "bg-orange-400",
  critical: "bg-red-400",
};

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

interface TaskFormData {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  category: string;
  reminder: boolean;
}

const DEFAULT_FORM: TaskFormData = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: "",
  dueTime: "",
  category: "",
  reminder: false,
};

export default function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask, toggleThoughtsPanel } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormData>(DEFAULT_FORM);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
      const matchPriority = filterPriority === "all" || t.priority === filterPriority;
      return matchSearch && matchPriority;
    });
  }, [tasks, search, filterPriority]);

  const todayTasks = filtered.filter(
    (t) => t.dueDate && isToday(t.dueDate) && t.status !== "done"
  );
  const upcomingTasks = filtered.filter(
    (t) => (!t.dueDate || !isToday(t.dueDate)) && t.status !== "done"
  );
  const doneTasks = filtered.filter((t) => t.status === "done");

  function openCreate() {
    setEditId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      dueTime: task.dueTime ?? "",
      category: task.category ?? "",
      reminder: task.reminder ?? false,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    if (editId) {
      updateTask(editId, {
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        category: form.category || undefined,
        reminder: form.reminder,
      });
    } else {
      addTask({
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: "todo",
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        category: form.category || undefined,
        reminder: form.reminder,
      });
    }
    setDialogOpen(false);
  }

  function toggleDone(task: Task) {
    updateTask(task.id, {
      status: task.status === "done" ? "todo" : "done",
    });
  }

  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    critical: tasks.filter((t) => t.priority === "critical" && t.status !== "done").length,
    today: tasks.filter((t) => t.dueDate && isToday(t.dueDate) && t.status !== "done").length,
  };

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-blue-400" /> Task Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {stats.done}/{stats.total} completed · {stats.today} due today
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleThoughtsPanel} className="gap-1">
            <Brain className="w-4 h-4" /> AI assist
          </Button>
          <Button onClick={openCreate} className="gap-1">
            <Plus className="w-4 h-4" /> New task
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Circle, color: "text-muted-foreground" },
          { label: "Done", value: stats.done, icon: CheckCircle2, color: "text-green-400" },
          { label: "Today", value: stats.today, icon: Flame, color: "text-orange-400" },
          { label: "Critical", value: stats.critical, icon: AlertCircle, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={cn("w-5 h-5 shrink-0", color)} />
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as Priority | "all")}>
          <SelectTrigger className="w-[140px]">
            <Filter className="w-3 h-3 mr-1" />
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

      {/* Task tabs */}
      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">
            Today <span className="ml-1.5 text-[10px] bg-orange-500/20 text-orange-400 rounded px-1">{todayTasks.length}</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming <span className="ml-1.5 text-[10px] bg-muted rounded px-1">{upcomingTasks.length}</span>
          </TabsTrigger>
          <TabsTrigger value="done">
            Done <span className="ml-1.5 text-[10px] bg-green-500/20 text-green-400 rounded px-1">{doneTasks.length}</span>
          </TabsTrigger>
        </TabsList>

        {[
          { value: "today", list: todayTasks, empty: "No tasks due today — enjoy your day!" },
          { value: "upcoming", list: upcomingTasks, empty: "No upcoming tasks. Add one above." },
          { value: "done", list: doneTasks, empty: "Nothing completed yet. Get going!" },
        ].map(({ value, list, empty }) => (
          <TabsContent key={value} value={value} className="mt-4 space-y-2">
            {list.length === 0 ? (
              <EmptyState label={empty} />
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

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title *</label>
              <Input
                placeholder="What needs to be done?"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
              <Textarea
                placeholder="Add more details…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="resize-none h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                <Input
                  placeholder="e.g. Work, Personal"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due date</label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due time</label>
                <Input
                  type="time"
                  value={form.dueTime}
                  onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.reminder}
                onChange={(e) => setForm({ ...form, reminder: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Set reminder</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>
              {editId ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskRow({
  task, onToggle, onEdit, onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "done";
  return (
    <div className={cn(
      "group flex items-start gap-3 p-3.5 rounded-xl border border-border hover:border-border/80 bg-card transition-all",
      done && "opacity-60"
    )}>
      <button onClick={onToggle} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", done && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <div className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize font-medium", PRIORITY_COLOR[task.priority])}>
            {task.priority}
          </div>
          {task.dueDate && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(task.dueDate)}
              {task.dueTime && ` · ${task.dueTime}`}
            </span>
          )}
          {task.category && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {task.category}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
