"use client";

import { useState, useRef, useEffect } from "react";
import { Brain, X, Send, Loader2, Sparkles, Zap, Bot } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { callThoughts } from "@/lib/thoughts-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ThoughtsAction } from "@/types";

const PROVIDER_BADGE = {
  claude: { label: "Claude", className: "bg-orange-500/20 text-orange-400", icon: Brain },
  gemini: { label: "Gemini", className: "bg-blue-500/20 text-blue-400", icon: Zap },
  local:  { label: "Local AI", className: "bg-muted text-muted-foreground", icon: Bot },
};

export function ThoughtsPanel() {
  const {
    thoughtsPanelOpen, toggleThoughtsPanel,
    messages, addMessage,
    addTask, addEvent,
  } = useAppStore();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastProvider, setLastProvider] = useState<"claude" | "gemini" | "local" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    addMessage({ role: "user", content: text });
    setLoading(true);

    try {
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await callThoughts(text, history);
      setLastProvider(res.provider ?? "local");
      addMessage({ role: "assistant", content: res.reply, actions: res.actions });
    } finally {
      setLoading(false);
    }
  }

  function applyAction(action: ThoughtsAction) {
    if (action.type === "create_task") {
      const d = action.data as { title: string; priority?: string; dueDate?: string; dueTime?: string };
      addTask({
        title: d.title,
        priority: (d.priority as "low" | "medium" | "high" | "critical") ?? "medium",
        status: "todo",
        dueDate: d.dueDate,
        dueTime: d.dueTime,
        reminder: false,
      });
      addMessage({ role: "assistant", content: `✓ Task created: "${d.title}"` });
    } else if (action.type === "create_event") {
      const d = action.data as { title: string; date: string; startTime?: string; type?: string };
      addEvent({
        title: d.title,
        date: d.date,
        startTime: d.startTime,
        type: (d.type as "meeting" | "task" | "reminder" | "personal" | "study") ?? "meeting",
        reminder: false,
      });
      addMessage({ role: "assistant", content: `✓ Added to calendar: "${d.title}"` });
    } else if (action.type === "journal_insight") {
      addMessage({ role: "assistant", content: "Head to Journal to log this entry — I've noted the mood context." });
    }
  }

  if (!thoughtsPanelOpen) return null;

  const providerInfo = lastProvider ? PROVIDER_BADGE[lastProvider] : null;

  return (
    <div className="fixed right-0 top-0 h-full w-[360px] z-50 flex flex-col border-l border-border bg-background shadow-2xl animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-background" />
          </div>
          <div>
            <p className="font-semibold text-sm">Thoughts</p>
            <p className="text-[10px] text-muted-foreground">Your AI assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Provider badge */}
          {providerInfo && (
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1", providerInfo.className)}>
              <providerInfo.icon className="w-3 h-3" />
              {providerInfo.label}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={toggleThoughtsPanel} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Hey, I&apos;m Thoughts</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tell me what&apos;s on your mind — tasks, plans, ideas, anything.
            </p>
            {/* Provider chain info */}
            <div className="mt-4 flex justify-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-400">
                <Brain className="w-3 h-3" /> Claude
              </span>
              <span className="text-muted-foreground self-center">→</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
                <Zap className="w-3 h-3" /> Gemini
              </span>
              <span className="text-muted-foreground self-center">→</span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                <Bot className="w-3 h-3" /> Local
              </span>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex flex-col gap-2", msg.role === "user" && "items-end")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              )}
            >
              {msg.content}
            </div>

            {/* Action buttons */}
            {msg.actions && msg.actions.length > 0 && (
              <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
                {msg.actions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => applyAction(action)}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-3 h-3 text-muted-foreground shrink-0" />
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Thoughts is thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Tell Thoughts anything…"
            className="flex-1 text-sm"
            disabled={loading}
          />
          <Button size="icon" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
