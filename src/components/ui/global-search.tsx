"use client";

import { useState, useEffect, useRef } from "react";
import { Search, CheckSquare, BookOpen, Calendar, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "task" | "journal" | "event";
  title: string;
  subtitle?: string;
  href: string;
}

const TYPE_ICON = {
  task:    { icon: CheckSquare, color: "text-blue-400",   bg: "bg-blue-500/10"   },
  journal: { icon: BookOpen,    color: "text-green-400",  bg: "bg-green-500/10"  },
  event:   { icon: Calendar,    color: "text-purple-400", bg: "bg-purple-500/10" },
};

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tasks, journals, events } = useAppStore();
  const [query,   setQuery]   = useState("");
  const [focused, setFocused] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const router    = useRouter();

  useEffect(() => {
    if (open) { setQuery(""); setFocused(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setFocused((f) => Math.min(f + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setFocused((f) => Math.max(f - 1, 0)); }
      if (e.key === "Enter" && results[focused]) navigate(results[focused]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focused]);

  const q = query.toLowerCase().trim();

  const results: SearchResult[] = q.length < 2 ? [] : [
    ...tasks
      .filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .slice(0, 4)
      .map((t) => ({ id: t.id, type: "task" as const, title: t.title, subtitle: t.dueDate ? formatDate(t.dueDate) : t.priority, href: "/tasks" })),
    ...journals
      .filter((j) => j.title.toLowerCase().includes(q) || j.content.toLowerCase().includes(q))
      .slice(0, 4)
      .map((j) => ({ id: j.id, type: "journal" as const, title: j.title, subtitle: formatDate(j.createdAt), href: "/journal" })),
    ...events
      .filter((e) => e.title.toLowerCase().includes(q))
      .slice(0, 3)
      .map((e) => ({ id: e.id, type: "event" as const, title: e.title, subtitle: formatDate(e.date), href: "/calendar" })),
  ];

  function navigate(r: SearchResult) {
    router.push(r.href);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[10vh] px-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocused(0); }}
            placeholder="Search tasks, journal, calendar…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {q.length >= 2 && (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/50">
            {results.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No results for &quot;{query}&quot;</div>
            ) : (
              results.map((r, i) => {
                const { icon: Icon, color, bg } = TYPE_ICON[r.type];
                return (
                  <button
                    key={r.id}
                    onClick={() => navigate(r)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                      i === focused ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bg)}>
                      <Icon className={cn("w-4 h-4", color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      {r.subtitle && <p className="text-[11px] text-muted-foreground capitalize">{r.subtitle}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-md shrink-0">{r.type}</span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {q.length < 2 && (
          <div className="py-8 text-center text-xs text-muted-foreground">Type at least 2 characters to search</div>
        )}

        <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">↵</kbd> open</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
