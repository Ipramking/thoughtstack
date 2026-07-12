import { describe, it, expect, beforeEach, vi } from "vitest";

// The store persists through idb-keyval (browser-only) — stub it out.
vi.mock("idb-keyval", () => ({
  get: async () => undefined,
  set: async () => {},
  del: async () => {},
}));

import { useAppStore } from "@/store/useAppStore";
import { Task } from "@/types";

const baseTask = (over: Partial<Task> = {}): Omit<Task, "id" | "createdAt" | "updatedAt"> => ({
  title: "Test task",
  priority: "medium",
  status: "todo",
  reminder: false,
  ...over,
});

function resetStore() {
  useAppStore.setState({
    tasks: [], journals: [], events: [], habits: [],
    pendingDeletes: { tasks: [], journals: [], events: [] },
  });
}

describe("recurrence — completeTask spawns the next occurrence", () => {
  beforeEach(resetStore);

  it("daily task rolls to the next day", () => {
    const t = useAppStore.getState().addTask(baseTask({ dueDate: "2026-07-13", recurrence: "daily" }));
    useAppStore.getState().completeTask(t.id);

    const tasks = useAppStore.getState().tasks;
    const next = tasks.find((x) => x.status === "todo");
    expect(next).toBeDefined();
    expect(next!.dueDate).toBe("2026-07-14");
    expect(next!.parentId).toBe(t.id);
    expect(tasks.find((x) => x.id === t.id)!.status).toBe("done");
  });

  it("weekdays recurrence skips the weekend", () => {
    // 2026-07-17 is a Friday → next weekday occurrence is Monday 2026-07-20
    const t = useAppStore.getState().addTask(baseTask({ dueDate: "2026-07-17", recurrence: "weekdays" }));
    useAppStore.getState().completeTask(t.id);

    const next = useAppStore.getState().tasks.find((x) => x.status === "todo");
    expect(next!.dueDate).toBe("2026-07-20");
  });

  it("non-recurring task does not spawn a copy", () => {
    const t = useAppStore.getState().addTask(baseTask({ dueDate: "2026-07-13" }));
    useAppStore.getState().completeTask(t.id);
    expect(useAppStore.getState().tasks).toHaveLength(1);
  });
});

describe("dedupTasks", () => {
  beforeEach(resetStore);

  it("keeps the newest duplicate and queues the rest for server deletion", () => {
    const { upsertTask, dedupTasks } = useAppStore.getState();
    upsertTask({ id: "a", title: "Buy milk", priority: "medium", status: "todo", reminder: false, dueDate: "2026-07-13", createdAt: "2026-07-01T10:00:00Z", updatedAt: "2026-07-01T10:00:00Z" });
    upsertTask({ id: "b", title: "buy milk ", priority: "medium", status: "todo", reminder: false, dueDate: "2026-07-13", createdAt: "2026-07-02T10:00:00Z", updatedAt: "2026-07-02T10:00:00Z" });
    upsertTask({ id: "c", title: "Different task", priority: "low", status: "todo", reminder: false, createdAt: "2026-07-01T10:00:00Z", updatedAt: "2026-07-01T10:00:00Z" });

    const removed = useAppStore.getState().dedupTasks();
    expect(removed).toBe(1);

    const state = useAppStore.getState();
    expect(state.tasks).toHaveLength(2);
    // Newest of the duplicate pair survives
    expect(state.tasks.some((t) => t.id === "b")).toBe(true);
    expect(state.tasks.some((t) => t.id === "a")).toBe(false);
    // CRITICAL: removed id must reach pendingDeletes or the next pull resurrects it
    expect(state.pendingDeletes.tasks).toContain("a");
    void dedupTasks; // (destructured above for clarity)
  });
});

describe("upsert last-write-wins", () => {
  beforeEach(resetStore);

  it("older remote task does NOT overwrite newer local edits", () => {
    const { upsertTask } = useAppStore.getState();
    upsertTask({ id: "x", title: "Local newer", priority: "high", status: "todo", reminder: false, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-10T00:00:00Z" });
    upsertTask({ id: "x", title: "Remote older", priority: "low", status: "todo", reminder: false, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-05T00:00:00Z" });

    expect(useAppStore.getState().tasks[0].title).toBe("Local newer");
  });

  it("newer remote event wins now that events carry updatedAt", () => {
    const { upsertEvent } = useAppStore.getState();
    upsertEvent({ id: "e", title: "Old title", type: "meeting", date: "2026-07-13", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z" });
    upsertEvent({ id: "e", title: "Edited elsewhere", type: "meeting", date: "2026-07-13", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-11T00:00:00Z" });

    expect(useAppStore.getState().events[0].title).toBe("Edited elsewhere");
  });

  it("updateEvent stamps updatedAt so edits actually propagate", () => {
    const e = useAppStore.getState().addEvent({ title: "Standup", type: "meeting", date: "2026-07-13" });
    useAppStore.getState().updateEvent(e.id, { title: "Standup (moved)" });
    const updated = useAppStore.getState().events.find((x) => x.id === e.id)!;
    expect(updated.updatedAt).toBeDefined();
    expect(updated.updatedAt! >= e.createdAt).toBe(true);
  });
});

describe("deletes are tracked for sync", () => {
  beforeEach(resetStore);

  it("deleteTask queues the id in pendingDeletes", () => {
    const t = useAppStore.getState().addTask(baseTask());
    useAppStore.getState().deleteTask(t.id);
    expect(useAppStore.getState().pendingDeletes.tasks).toContain(t.id);
  });

  it("clearPendingDeletes removes only the acknowledged ids", () => {
    const a = useAppStore.getState().addTask(baseTask({ title: "A" }));
    const b = useAppStore.getState().addTask(baseTask({ title: "B" }));
    useAppStore.getState().deleteTask(a.id);
    useAppStore.getState().deleteTask(b.id);

    useAppStore.getState().clearPendingDeletes("tasks", [a.id]);
    const pending = useAppStore.getState().pendingDeletes.tasks;
    expect(pending).not.toContain(a.id);
    expect(pending).toContain(b.id);
  });
});
