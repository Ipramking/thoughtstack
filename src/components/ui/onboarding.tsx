"use client";

import { useState } from "react";
import { Brain, CheckSquare, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Brain, color: "bg-foreground", iconColor: "text-background",
    title: "Welcome to ThoughtStack",
    subtitle: "Your AI-powered personal OS",
    body: "Capture thoughts, manage tasks, journal your days — and let Thoughts AI connect it all for you.",
    cta: "Get started",
  },
  {
    icon: CheckSquare, color: "bg-blue-500/20", iconColor: "text-blue-400",
    title: "Tasks that think with you",
    subtitle: "Smart, context-aware task management",
    body: "Just type what you need to do. Thoughts parses dates, times, and priorities automatically from plain English.",
    cta: "Got it",
  },
  {
    icon: BookOpen, color: "bg-green-500/20", iconColor: "text-green-400",
    title: "Journal + AI insights",
    subtitle: "Write freely, let AI extract the action",
    body: "Write a journal entry and tap Save & Analyse. Thoughts reads it and surfaces hidden tasks and patterns.",
    cta: "Open Thoughts AI",
  },
];

export function Onboarding() {
  const { onboarded, setOnboarded, toggleThoughtsPanel } = useAppStore();
  const [step, setStep] = useState(0);

  if (onboarded) return null;

  const current = STEPS[step];
  const Icon    = current.icon;
  const isLast  = step === STEPS.length - 1;

  function advance() {
    if (isLast) {
      setOnboarded();
      setTimeout(() => toggleThoughtsPanel(), 400);
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-sm text-center space-y-8 animate-fade-up">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-300",
                i === step ? "w-6 h-2 bg-foreground" : "w-2 h-2 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        {/* Icon */}
        <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-lg", current.color)}>
          <Icon className={cn("w-9 h-9", current.iconColor)} />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{current.title}</h1>
          <p className="text-sm font-medium text-primary">{current.subtitle}</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">{current.body}</p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={advance}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-foreground text-background rounded-2xl font-semibold text-sm hover:opacity-90 active:scale-95 transition-all"
          >
            {isLast
              ? <><Sparkles className="w-4 h-4" /> {current.cta}</>
              : <>{current.cta} <ArrowRight className="w-4 h-4" /></>
            }
          </button>
          <button
            onClick={() => setOnboarded()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip intro
          </button>
        </div>
      </div>
    </div>
  );
}
