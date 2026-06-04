"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { KeyRound, Trash2, Mail, ShieldAlert, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/useToast";

function Row({ label, description, action }: { label: string; description?: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border/60 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 mb-1">{children}</p>;
}

export default function AccountPage() {
  const { data: session } = useSession();
  const router  = useRouter();
  const email   = session?.user?.email ?? "";
  const name    = session?.user?.name  ?? "";

  // ── Change password state ──────────────────────────────────────────────────
  const [pwOpen,        setPwOpen]    = useState(false);
  const [pwCurrent,     setPwCurrent] = useState("");
  const [pwNew,         setPwNew]     = useState("");
  const [pwConfirm,     setPwConfirm] = useState("");
  const [pwShow,        setPwShow]    = useState(false);
  const [pwSaving,      setPwSaving]  = useState(false);

  async function handleChangePassword() {
    if (pwNew !== pwConfirm) { toast.error("New passwords don't match"); return; }
    if (pwNew.length < 6)    { toast.error("New password must be at least 6 characters"); return; }
    if (pwNew === pwCurrent) { toast.error("New password must differ from current"); return; }

    setPwSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not update password"); return; }
      toast.success("Password updated");
      setPwOpen(false);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch {
      toast.error("Network error — try again");
    } finally {
      setPwSaving(false);
    }
  }

  // ── Delete-account state ───────────────────────────────────────────────────
  const [delOpen,    setDelOpen]    = useState(false);
  const [delPw,      setDelPw]      = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [delShowPw,  setDelShowPw]  = useState(false);
  const [delRunning, setDelRunning] = useState(false);

  async function handleDeleteAccount() {
    if (delConfirm !== "DELETE") { toast.error("Type DELETE to confirm"); return; }
    if (!delPw)                  { toast.error("Enter your password");   return; }

    setDelRunning(true);
    try {
      const res = await fetch("/api/account/delete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password: delPw, confirmText: delConfirm }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not delete account"); setDelRunning(false); return; }

      toast.success("Account deleted — signing out");
      // Wipe local data before signing out so the cleared user can't reuse the cache
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        localStorage.clear();
        sessionStorage.clear();
        if ("indexedDB" in window) {
          const dbs = await (indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }).databases?.();
          if (dbs) await Promise.all(dbs.map((db) => db.name ? new Promise<void>((res) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = req.onerror = req.onblocked = () => res();
          }) : Promise.resolve()));
        }
      } catch {/* ignore — signOut will redirect anyway */}

      await signOut({ redirect: false });
      router.replace("/auth");
    } catch {
      toast.error("Network error — try again");
      setDelRunning(false);
    }
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-5 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-6 page-enter max-w-2xl mx-auto">
        <PageHeader
          title="Account"
          subtitle="Manage your sign-in and account data."
          onBack={() => router.push("/settings")}
        />

        {/* Signed-in identity */}
        <div className="space-y-2">
          <Section>Signed in as</Section>
          <Card><CardContent className="p-5">
            <Row
              label={name || "Unnamed user"}
              description={email}
              action={
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                  <Mail className="w-3.5 h-3.5" /> Verified
                </span>
              }
            />
          </CardContent></Card>
        </div>

        {/* Security */}
        <div className="space-y-2">
          <Section>Security</Section>
          <Card><CardContent className="p-5 space-y-0 divide-y divide-border/60">
            <Row
              label="Change password"
              description="Update the password you use to sign in."
              action={
                <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setPwOpen(true)}>
                  <KeyRound className="w-3.5 h-3.5" /> Change
                </Button>
              }
            />
          </CardContent></Card>
        </div>

        {/* Danger zone */}
        <div className="space-y-2">
          <Section>Danger zone</Section>
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardDescription className="text-destructive/80 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                These actions are permanent and cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-0 divide-y divide-border/60">
              <Row
                label="Delete account"
                description="Permanently remove your account and every task, journal entry, calendar event, habit, reminder, and push subscription tied to it."
                action={
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl gap-1.5"
                    onClick={() => setDelOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Change password dialog ────────────────────────────────────────── */}
      <Dialog open={pwOpen} onOpenChange={(v) => !pwSaving && setPwOpen(v)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Change password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Current password</label>
              <div className="relative">
                <Input
                  type={pwShow ? "text" : "password"}
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  className="rounded-xl pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setPwShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label={pwShow ? "Hide passwords" : "Show passwords"}
                >
                  {pwShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">New password</label>
              <Input
                type={pwShow ? "text" : "password"}
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                className="rounded-xl"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Confirm new password</label>
              <Input
                type={pwShow ? "text" : "password"}
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setPwOpen(false)}
              disabled={pwSaving}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl gap-1.5"
              onClick={handleChangePassword}
              disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
            >
              {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {pwSaving ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete-account dialog ─────────────────────────────────────────── */}
      <Dialog open={delOpen} onOpenChange={(v) => !delRunning && setDelOpen(v)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Delete account
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs leading-relaxed">
              <p className="font-semibold text-destructive mb-1.5">This will permanently:</p>
              <ul className="space-y-1 text-foreground/80 list-disc pl-5">
                <li>Delete your sign-in account ({email})</li>
                <li>Erase every task, journal entry, calendar event, and habit on the server</li>
                <li>Remove every push subscription and scheduled reminder</li>
                <li>Sign you out and wipe local browser data</li>
              </ul>
              <p className="text-muted-foreground mt-2">This cannot be undone. There is no recovery.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Enter your password
              </label>
              <div className="relative">
                <Input
                  type={delShowPw ? "text" : "password"}
                  value={delPw}
                  onChange={(e) => setDelPw(e.target.value)}
                  className="rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setDelShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  {delShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Type <span className="font-bold text-destructive">DELETE</span> to confirm
              </label>
              <Input
                value={delConfirm}
                onChange={(e) => setDelConfirm(e.target.value)}
                className="rounded-xl"
                placeholder="DELETE"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDelOpen(false)}
              disabled={delRunning}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl gap-1.5"
              onClick={handleDeleteAccount}
              disabled={delRunning || delConfirm !== "DELETE" || !delPw}
            >
              {delRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {delRunning ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
