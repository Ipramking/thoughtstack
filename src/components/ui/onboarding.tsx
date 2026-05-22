"use client";

import { useState } from "react";
import { Brain, CheckSquare, Sparkles, ArrowRight, Zap } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "welcome",
    icon: Brain,
    iconBg: "bg-foreground",
    iconColor: "text-background",
    title: "Welcome to ThoughtStack",
    subtitle: "Your AI-powered personal operating system for tasks, habits, learning, and more.",
  },
  {
    id: "name",
    icon: Sparkles,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    title: "What should I call you?",
    subtitle: "Thoughts AI will use this to personalise your experience.",
  },
  {
    id: "task",
    icon: CheckSquare,
    iconBg: "bg-green-500/10",
    iconColor: "text-green-400",
    title: "Add your first task",
    subtitle: "What's one thing you need to get done? Start small.",
  },
  {
    id: "done",
    icon: Zap,
    iconBg: "bg-yellow-500/10",
    iconColor: "text-yellow-400",
    title: "You're all set! ⚡",
    subtitle: "Thoughts AI knows your tasks, habits, and schedule. Just ask it anything.",
  },
];

export function Onboarding() {
  const { onboarded, setOnboarded, updateProfile, addTask } = useAppStore();

  const [step,     setStep]     = useState(0);
  const [name,     setName]     = useState("");
  const [taskText, setTaskText] = useState("");

  if (onboarded) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (step === 1 && name.trim()) {
      updateProfile({ name: name.trim() });
    }
    if (step === 2 && taskText.trim()) {
      addTask({ title: taskText.trim(), priority: "medium", status: "todo", reminder: false });
    }
    if (isLast) {
      setOnboarded();
    } else {
      setStep((s) => s + 1);
    }
  }

  const canProceed =
    step === 0 ? true :
    step === 1 ? name.trim().length > 0 :
    step === 2 ? true : // task is optional
    true;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md" />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-end sm:items-center justify-center p-4">
        <div className={cn(
          "w-full max-w-sm bg-background border border-border rounded-3xl shadow-2xl",
          "flex flex-col overflow-hidden animate-scale-in"
        )}>
          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 pt-5">
            {STEPS.map((_, i) => (
              <div key={i} className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-foreground" : i < step ? "w-3 bg-foreground/40" : "w-3 bg-muted"
              )} />
            ))}
          </div>

          {/* Content */}
          <div className="flex flex-col items-center text-center px-6 pt-6 pb-4 gap-4">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", current.iconBg)}>
              <Icon className={cn("w-8 h-8", current.iconColor)} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{current.title}</h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[260px] mx-auto">
                {current.subtitle}
              </p>
            </div>

            {/* Step-specific inputs */}
            {step === 1 && (
              <Input
                placeholder="Your name…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canProceed && handleNext()}
                className="rounded-xl text-center text-base"
                autoFocus
              />
            )}

            {step === 2 && (
              <Input
                placeholder="e.g. Review project proposal…"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                className="rounded-xl text-sm"
                autoFocus
              />
            )}

            {step === 3 && (
              <div className="w-full space-y-2 text-left bg-muted/40 rounded-2xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">What you can do:</p>
                {[
                  "💬 Ask Thoughts AI anything about your day",
                  "✅ Track tasks with priorities and due dates",
                  "🔥 Build habits with daily streaks",
                  "📓 Journal with mood tracking",
                  "⚡ Level up skills with missions",
                ].map((item) => (
                  <p key={item} className="text-xs text-foreground/80 leading-relaxed">{item}</p>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-safe pb-6 pt-2 flex flex-col gap-2">
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="w-full rounded-xl h-12 text-sm font-semibold gap-2"
            >
              {isLast ? "Start using ThoughtStack" : step === 2 && !taskText.trim() ? "Skip for now" : "Continue"}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
