"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Brain, ArrowRight, Zap, CheckSquare, BookOpen,
  Calendar, BarChart2, Loader2, Lock, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";

const FEATURES = [
  { icon: CheckSquare, label: "Smart Task Manager",       color: "text-blue-400"   },
  { icon: BookOpen,    label: "AI Journal & Mood Tracking", color: "text-green-400"  },
  { icon: Zap,         label: "Personalized Learning",     color: "text-yellow-400" },
  { icon: Calendar,    label: "Intelligent Scheduling",    color: "text-purple-400" },
  { icon: BarChart2,   label: "Deep Analytics",            color: "text-orange-400" },
  { icon: Brain,       label: "Thoughts AI Assistant",     color: "text-pink-400"   },
];

function AuthForm() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const from          = searchParams.get("from") ?? "/";

  const { profile, updateProfile } = useAppStore();
  const [name,        setName]        = useState(profile.name !== "User" ? profile.name : "");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [hasPassword, setHasPassword] = useState(false);

  const isReturning = profile.name !== "User" && profile.name !== "";

  // Check if app has a password configured
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setHasPassword(d.hasPassword ?? false))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter your name to continue."); return; }
    if (hasPassword && !password) { setError("Password is required."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", name: trimmed, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }

      updateProfile({ name: trimmed });
      toast.success(`Welcome back, ${trimmed.split(" ")[0]}!`);
      router.push(from === "/auth" ? "/" : from);
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
          <Brain className="w-5 h-5 text-background" />
        </div>
        <div>
          <p className="font-bold text-lg leading-none">ThoughtStack</p>
          <p className="text-xs text-muted-foreground">Your Personal OS</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-1">
        {isReturning ? `Welcome back, ${profile.name.split(" ")[0]} 👋` : "Get started"}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {isReturning
          ? "Your session expired. Sign back in to continue."
          : "Enter your details to launch your personal workspace."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            {isReturning ? "Your name" : "What should Thoughts call you?"}
          </label>
          <Input
            placeholder="e.g. Alex, Jordan…"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            autoFocus={!isReturning}
            className="h-11"
          />
        </div>

        {hasPassword && (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Password
            </label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoFocus={isReturning}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
          ) : (
            <>{isReturning ? "Continue" : "Launch ThoughtStack"} <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </form>

      <p className="text-[11px] text-muted-foreground mt-4 text-center">
        Your data stays on your device.{" "}
        {hasPassword && <span className="text-green-400">🔒 Password protected</span>}
      </p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        <Suspense fallback={
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        }>
          <AuthForm />
        </Suspense>
      </div>

      {/* Feature showcase — hidden on mobile */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-12 bg-muted/30 border-l border-border">
        <div className="max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Everything in one place
          </p>
          <h2 className="text-3xl font-bold mb-2">
            An OS for your{" "}
            <span className="text-muted-foreground">mind</span>
          </h2>
          <p className="text-sm text-muted-foreground mb-10">
            ThoughtStack connects your tasks, journals, learning, and calendar — with
            an AI that understands plain language and acts on it.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 p-4 rounded-xl bg-background border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Thoughts AI — Powered by
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-md bg-orange-500/10 text-orange-400 font-medium">Claude</span>
              <span className="text-muted-foreground">→</span>
              <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 font-medium">Gemini</span>
              <span className="text-muted-foreground">→</span>
              <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium">Local AI</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Automatic fallback — always available, even offline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
