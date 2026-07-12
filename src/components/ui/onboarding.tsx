"use client";

import { useState } from "react";
import { Brain, CheckSquare, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Onboarding() {
  const { onboarded, setOnboarded, toggleThoughtsPanel, updateProfile } = useAppStore();
  const [step, setStep]     = useState(0);
  const [name, setName]     = useState("");

  if (onboarded) return null;

  const STEPS = [
    {
      icon: Brain, color: "brand-gradient shadow-primary/25", iconColor: "text-white",
      title: "Welcome to ThoughtStack",
      subtitle: "Your AI-powered personal OS",
      body: "Capture thoughts, manage tasks, journal your days — and let Thoughts AI connect it all for you.",
    },
    {
      icon: CheckSquare, color: "bg-blue-500/20", iconColor: "text-blue-400",
      title: "Tasks that think with you",
      subtitle: "Smart, context-aware task management",
      body: "Just type what you need to do. Thoughts parses dates, times, and priorities automatically from plain English.",
    },
    {
      icon: BookOpen, color: "bg-green-500/20", iconColor: "text-green-400",
      title: "Journal + AI insights",
      subtitle: "Write freely, let AI extract the action",
      body: "Write an entry and tap Save & Analyse. Thoughts reads it and surfaces hidden tasks and patterns.",
    },
  ];

  const current = STEPS[step];
  const Icon    = current.icon;
  const isLast  = step === STEPS.length - 1;
  const isFirst = step === 0;

  function advance() {
    if (isFirst && name.trim()) {
      updateProfile({ name: name.trim() });
    }
    if (isLast) {
      setOnboarded();
      setTimeout(() => toggleThoughtsPanel(), 400);
    } else {
      setStep((s) => s + 1);
    }
  }

  const canAdvance = !isFirst || name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm text-center space-y-8 animate-fade-up">

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <div key={i} className={cn(
              "rounded-full transition-all duration-300",
              i === step ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30",
            )} />
          ))}
        </div>

        {/* Icon */}
        <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg", current.color)}>
          <Icon className={cn("w-9 h-9", current.iconColor)} />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold tracking-tight">{current.title}</h1>
          <p className="text-sm font-medium text-primary">{current.subtitle}</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">{current.body}</p>
        </div>

        {/* Name input on step 1 */}
        {isFirst && (
          <Input
            placeholder="What's your name?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canAdvance && advance()}
            className="rounded-2xl text-center text-base h-12"
            autoFocus
          />
        )}

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={advance}
            disabled={!canAdvance}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-semibold text-sm transition-all",
              canAdvance
                ? "brand-gradient hover:opacity-90 active:scale-95 shadow-md shadow-primary/25"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {isLast
              ? <><Sparkles className="w-4 h-4" /> Open Thoughts AI</>
              : <>Continue <ArrowRight className="w-4 h-4" /></>
            }
          </button>
          <button
            onClick={() => {
              if (name.trim()) updateProfile({ name: name.trim() });
              setOnboarded();
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip intro
          </button>
        </div>
      </div>
    </div>
  );
}
