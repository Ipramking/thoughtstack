"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Brain, Zap, CheckSquare, BookOpen, Calendar,
  BarChart2, Loader2, Eye, EyeOff, ArrowRight, Lock, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { useAppStore } from "@/store/useAppStore";

const FEATURES = [
  { icon: CheckSquare, label: "Smart Task Manager",        color: "text-blue-400"   },
  { icon: BookOpen,    label: "AI Journal & Mood Tracking", color: "text-green-400"  },
  { icon: Zap,         label: "Personalized Learning",      color: "text-yellow-400" },
  { icon: Calendar,    label: "Intelligent Scheduling",     color: "text-purple-400" },
  { icon: BarChart2,   label: "Deep Analytics",             color: "text-orange-400" },
  { icon: Brain,       label: "Thoughts AI Assistant",      color: "text-pink-400"   },
];

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") ?? searchParams.get("from") ?? "/";
  const authError    = searchParams.get("error");

  const { updateProfile } = useAppStore();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(
    authError === "CredentialsSignin" ? "Incorrect email or password." : ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email:    email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    // Sync the user's name into the Zustand store from the email prefix
    const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    updateProfile({ name });

    toast.success(`Welcome back, ${name.split(" ")[0]}!`);
    router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shadow-lg">
          <Brain className="w-5 h-5 text-background" />
        </div>
        <div>
          <p className="font-bold text-lg leading-none">ThoughtStack</p>
          <p className="text-xs text-muted-foreground">Your Personal OS</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-1">Sign in</h1>
      <p className="text-sm text-muted-foreground mb-7">
        Access your personal workspace.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Email address
          </label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            autoComplete="email"
            autoFocus
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            className="h-11"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> Password
          </label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              placeholder="Your password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="h-11 pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full h-11 gap-2 mt-2" disabled={loading}>
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
            : <>Sign in <ArrowRight className="w-4 h-4" /></>
          }
        </Button>
      </form>

      <p className="text-[11px] text-muted-foreground mt-5 text-center leading-relaxed">
        This is a private workspace. Only authorised users can sign in.
        <br />Your data is stored on your device.
      </p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── Left — login form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Suspense fallback={
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>

      {/* ── Right — feature panel (desktop only) ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-12 bg-muted/30 border-l border-border">
        <div className="max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Everything in one place
          </p>
          <h2 className="text-3xl font-bold mb-3">
            An OS for your{" "}
            <span className="text-muted-foreground">mind</span>
          </h2>
          <p className="text-sm text-muted-foreground mb-10">
            ThoughtStack connects your tasks, journals, learning, and calendar —
            with an AI that understands plain language and acts on it.
          </p>

          <div className="space-y-4 mb-10">
            {FEATURES.map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* AI chain badge */}
          <div className="p-4 rounded-xl bg-background border border-border">
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
