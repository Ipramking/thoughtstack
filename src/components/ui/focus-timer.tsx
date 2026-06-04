"use client";

import { useState } from "react";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { Play, Square, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Pomodoro", min: 25 },
  { label: "Deep work", min: 50 },
  { label: "Quick", min: 15 },
];

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Floating focus-timer badge.
 * Inactive: small button in bottom-right.
 * Active:   shows mm:ss countdown + stop button.
 */
export function FocusTimerBadge() {
  const { active, remainingMs, durationMs, taskTitle, start, stop } = useFocusTimer();
  const [open, setOpen] = useState(false);

  if (active) {
    const progress = durationMs > 0 ? 1 - remainingMs / durationMs : 0;
    return (
      <div className="fixed bottom-20 right-4 md:bottom-6 z-30 animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-card border border-border shadow-xl backdrop-blur">
          <div className="relative w-9 h-9">
            <svg viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="hsl(var(--primary))" strokeWidth="3"
                strokeDasharray={`${progress * 100} 100`}
                strokeLinecap="round"
              />
            </svg>
            <Clock className="absolute inset-0 m-auto w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tabular-nums leading-none">{formatTime(remainingMs)}</p>
            <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
              {taskTitle ?? "Focus session"}
            </p>
          </div>
          <button
            onClick={stop}
            className="ml-1 w-8 h-8 rounded-xl bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
            aria-label="Stop timer"
          >
            <Square className="w-3.5 h-3.5 text-destructive" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 z-30">
      {open && (
        <div className="absolute bottom-12 right-0 w-48 bg-card border border-border rounded-2xl shadow-xl p-2 animate-fade-in">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-2">
            Start focus session
          </p>
          {PRESETS.map(({ label, min }) => (
            <button
              key={label}
              onClick={() => { start(min); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-accent transition-colors text-left"
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{min} min</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-11 h-11 rounded-2xl bg-card border border-border shadow-lg flex items-center justify-center",
          "hover:bg-accent transition-colors active:scale-95",
        )}
        aria-label="Focus timer"
      >
        <Play className="w-4 h-4" />
      </button>
    </div>
  );
}
