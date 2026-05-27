"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Brain, X, Send, Loader2, Sparkles, Zap, Bot, ChevronDown, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { callThoughts } from "@/lib/thoughts-ai";
import { cn } from "@/lib/utils";
import { ThoughtsAction, ThoughtsContext } from "@/types";
import { toast } from "@/hooks/useToast";
import { format } from "date-fns";

const PROVIDER_BADGE = {
  claude: { label: "Claude",   cls: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Brain },
  gemini: { label: "Gemini",   cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",       icon: Zap   },
  local:  { label: "Local AI", cls: "bg-muted text-muted-foreground border-border",           icon: Bot   },
};

const QUICK_PROMPTS = [
  "What should I focus on today?",
  "How am I doing this week?",
  "Help me plan tomorrow",
  "Add a task for me",
  "Summarise my recent journal",
];

export function ThoughtsPanel() {
  const {
    thoughtsPanelOpen, toggleThoughtsPanel,
    messages, addMessage, clearMessages,
    addTask, addEvent,
    tasks, events, journals,
  } = useAppStore();

  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [lastProvider, setLastProvider] = useState<"claude" | "gemini" | "local" | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const context = useMemo((): ThoughtsContext => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return {
      todayTasks: tasks
        .filter((t) => t.dueDate === todayStr || (t.status !== "done" && !t.dueDate))
        .slice(0, 10)
        .map((t) => ({ title: t.title, priority: t.priority, status: t.status, dueTime: t.dueTime })),
      todayEvents: events
        .filter((e) => e.date === todayStr)
        .map((e) => ({ title: e.title, startTime: e.startTime, type: e.type })),
      recentJournals: journals.slice(0, 3).map((j) => ({
        title: j.title, mood: j.mood, date: j.createdAt.split("T")[0],
      })),
      stats: {
        tasksTotal:   tasks.length,
        tasksDone:    tasks.filter((t) => t.status === "done").length,
        journalCount: journals.length,
        streak:       useAppStore.getState().getStreak(),
      },
    };
  }, [tasks, events, journals]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (thoughtsPanelOpen) setTimeout(() => inputRef.current?.focus(), 350);
  }, [thoughtsPanelOpen]);

  useEffect(() => {
    if (!thoughtsPanelOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") toggleThoughtsPanel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [thoughtsPanelOpen, toggleThoughtsPanel]);

  async function handleSend(text = input.trim()) {
    if (!text || loading) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "40px";
    addMessage({ role: "user", content: text });
    setLoading(true);
    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const res = await callThoughts(text, history, context);
      setLastProvider((res.provider ?? "local") as "claude" | "gemini" | "local");
      addMessage({ role: "assistant", content: res.reply, actions: res.actions });
    } catch {
      addMessage({ role: "assistant", content: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function applyAction(action: ThoughtsAction) {
    if (action.type === "create_task") {
      const d = action.data as { title: string; priority?: string; dueDate?: string; dueTime?: string };
      addTask({ title: d.title, priority: (d.priority as "low"|"medium"|"high"|"critical") ?? "medium", status: "todo", dueDate: d.dueDate, dueTime: d.dueTime, reminder: false });
      addMessage({ role: "assistant", content: `✓ Task created: "${d.title}"` });
      toast.success("Task created");
    } else if (action.type === "create_event") {
      const d = action.data as { title: string; date: string; startTime?: string; type?: string };
      addEvent({ title: d.title, date: d.date, startTime: d.startTime, type: (d.type as "meeting"|"task"|"reminder"|"personal"|"study") ?? "meeting", reminder: false });
      addMessage({ role: "assistant", content: `✓ Added to calendar: "${d.title}"` });
      toast.success("Event added");
    } else {
      addMessage({ role: "assistant", content: "Head to Journal to log this entry." });
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  if (!thoughtsPanelOpen) return null;

  const providerInfo = lastProvider ? PROVIDER_BADGE[lastProvider] : null;

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden animate-fade-in"
        onClick={toggleThoughtsPanel}
        aria-hidden
      />

      {/* Panel */}
      <div className={cn(
        "fixed z-50 flex flex-col bg-background shadow-2xl border border-border",
        /* Mobile: full-height bottom sheet that clears the bottom nav */
        "bottom-0 left-0 right-0 rounded-t-3xl border-b-0",
        "h-[calc(100dvh-0px)] max-h-[92dvh] animate-slide-up",
        /* Desktop: right side panel */
        "md:bottom-0 md:right-0 md:top-0 md:left-auto md:h-full md:max-h-full md:w-[380px]",
        "md:rounded-none md:border-y-0 md:border-r-0 md:border-l md:animate-slide-right",
      )}>
        {/* Drag handle — mobile */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-background" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-none">Thoughts AI</p>
              {providerInfo ? (
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-full border", providerInfo.cls)}>
                  <providerInfo.icon className="w-2.5 h-2.5" /> {providerInfo.label}
                </span>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-0.5">Context-aware · Claude → Gemini → Local</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => { clearMessages(); setLastProvider(null); }}
                className="touch-target rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={toggleThoughtsPanel}
              className="touch-target rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="w-5 h-5 md:hidden" />
              <X className="w-4 h-4 hidden md:block" />
            </button>
          </div>
        </div>

        {/* Messages — min-h-0 critical for flex shrink */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-hide">
          <div className="p-4 space-y-4">

            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center text-center pt-4 pb-2">
                <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center mb-4 shadow-lg">
                  <Brain className="w-7 h-7 text-background" />
                </div>
                <p className="text-base font-bold">Hey, I&apos;m Thoughts</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px] leading-relaxed">
                  I know your tasks and schedule. Ask me anything or just dump your thoughts.
                </p>

                {/* Context snapshot */}
                <div className="mt-4 w-full max-w-[280px] bg-muted/40 rounded-2xl p-3 text-left space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your context today</p>
                  <p className="text-xs text-muted-foreground">📋 {context.todayTasks.filter((t) => t.status !== "done").length} tasks pending</p>
                  <p className="text-xs text-muted-foreground">📅 {context.todayEvents.length} events scheduled</p>
                  <p className="text-xs text-muted-foreground">📓 {context.stats.journalCount} journal entries</p>
                </div>

                {/* Quick prompts */}
                <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[280px]">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => handleSend(p)}
                      className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-2"
                    >
                      <Sparkles className="w-3 h-3 shrink-0 text-muted-foreground/60" /> {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex flex-col gap-1.5", msg.role === "user" ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm",
                )}>
                  {msg.content}
                </div>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
                    {msg.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => applyAction(action)}
                        className="text-left text-xs px-3.5 py-3 rounded-xl border border-border hover:bg-accent transition-colors flex items-center gap-2 min-h-[44px] font-medium"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" /> {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={bottomRef} className="h-1" />
          </div>
        </div>

        {/* Input — sticks above keyboard on mobile */}
        <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="p-3 pb-safe flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask about your day, tasks, plans…"
              rows={1}
              disabled={loading}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={cn(
                "flex-1 resize-none rounded-2xl bg-muted border border-border",
                "px-3.5 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                "transition-all min-h-[40px] max-h-[120px] scrollbar-hide overflow-y-auto disabled:opacity-50",
              )}
              style={{ height: "40px" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                "bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-95",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
              )}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
