"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Brain, Zap, CheckSquare, BookOpen, Calendar, BarChart2,
  Loader2, Eye, EyeOff, ArrowRight, Lock, Mail, User,
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

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") ?? "/";
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
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setLoading(true); setError("");

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.error) {
      const msg = result.error.includes("status:pending")
        ? "Your account is awaiting admin approval. You'll get an email when it's ready."
        : result.error.includes("status:rejected")
          ? "Your access request was not approved. Contact the admin."
          : "Incorrect email or password.";
      setError(msg);
      setLoading(false);
      return;
    }

    const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    updateProfile({ name });
    toast.success(`Welcome back!`);
    router.push(callbackUrl.startsWith("/") ? callbackUrl : "/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center shadow-lg shadow-primary/25">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-display font-bold text-lg leading-none">ThoughtStack</p>
          <p className="text-xs text-muted-foreground">Your Personal OS</p>
        </div>
      </div>

      <h1 className="text-2xl font-display font-bold mb-1">Welcome back</h1>
      <p className="text-sm text-muted-foreground mb-7">Sign in to your workspace.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Email address
          </label>
          <Input type="email" placeholder="you@example.com" value={email} autoFocus autoComplete="email"
            onChange={(e) => { setEmail(e.target.value); setError(""); }} className="h-11" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> Password
          </label>
          <div className="relative">
            <Input type={showPass ? "text" : "password"} placeholder="Your password" value={password}
              autoComplete="current-password" onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="h-11 pr-10" />
            <button type="button" tabIndex={-1} onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center mt-6">
        Don&apos;t have an account?{" "}
        <button onClick={onSwitch} className="text-primary font-medium hover:underline">
          Request access
        </button>
      </p>
    </div>
  );
}

// ─── Signup Form ──────────────────────────────────────────────────────────────
function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) { setError("All fields are required."); return; }
    setLoading(true); setError("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🎉</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Request sent!</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Your signup request has been submitted. The admin will review it and you&apos;ll
          receive an email at <strong>{email}</strong> once you&apos;re approved.
        </p>
        <p className="text-xs text-muted-foreground mb-6">This usually takes a short while.</p>
        <Button variant="outline" onClick={onSwitch} className="gap-1">
          ← Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center shadow-lg shadow-primary/25">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-display font-bold text-lg leading-none">ThoughtStack</p>
          <p className="text-xs text-muted-foreground">Request access</p>
        </div>
      </div>

      <h1 className="text-2xl font-display font-bold mb-1">Create account</h1>
      <p className="text-sm text-muted-foreground mb-7">
        Submit your details — the admin will approve your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <User className="w-3 h-3" /> Full name
          </label>
          <Input placeholder="Your name" value={name} autoFocus
            onChange={(e) => { setName(e.target.value); setError(""); }} className="h-11" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Email address
          </label>
          <Input type="email" placeholder="you@example.com" value={email} autoComplete="email"
            onChange={(e) => { setEmail(e.target.value); setError(""); }} className="h-11" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> Password
          </label>
          <div className="relative">
            <Input type={showPass ? "text" : "password"} placeholder="At least 6 characters" value={password}
              autoComplete="new-password" onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="h-11 pr-10" />
            <button type="button" tabIndex={-1} onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Request access <ArrowRight className="w-4 h-4" /></>}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-5 leading-relaxed">
        Your account won&apos;t be active until the admin approves it. You&apos;ll get an email confirmation.
      </p>

      <p className="text-sm text-muted-foreground text-center mt-4">
        Already have an account?{" "}
        <button onClick={onSwitch} className="text-primary font-medium hover:underline">
          Sign in
        </button>
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}>
          {mode === "login"
            ? <LoginForm  onSwitch={() => setMode("signup")} />
            : <SignupForm onSwitch={() => setMode("login")}  />
          }
        </Suspense>
      </div>

      {/* ── Feature showcase (desktop) ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-12 bg-muted/30 border-l border-border ambient-bg">
        <div className="max-w-sm relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-6">
            Everything in one place
          </p>
          <h2 className="text-3xl font-display font-bold mb-3">
            An OS for your <span className="brand-text-gradient">mind</span>
          </h2>
          <p className="text-sm text-muted-foreground mb-10">
            ThoughtStack connects your tasks, journals, learning, and calendar — with an AI
            that understands plain language and acts on it.
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
          </div>
        </div>
      </div>
    </div>
  );
}
