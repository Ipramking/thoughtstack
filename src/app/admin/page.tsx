"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Shield, Check, X, Trash2, Clock, UserCheck, UserX,
  Users, RefreshCw, Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !isAdmin) { router.replace("/"); return; }
    fetchUsers();
  }, [session, status, isAdmin, router]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(user: User) {
    setWorking(user.id);
    try {
      const res = await fetch("/api/admin/users/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, name: user.name, email: user.email }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Approved ${user.name}`, "Approval email sent.");
      await fetchUsers();
    } catch {
      toast.error("Failed to approve user");
    } finally {
      setWorking(null);
    }
  }

  async function handleReject(user: User) {
    if (!confirm(`Reject ${user.name}'s request?`)) return;
    setWorking(user.id);
    try {
      const res = await fetch("/api/admin/users/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, name: user.name, email: user.email }),
      });
      if (!res.ok) throw new Error();
      toast.info(`Rejected ${user.name}`);
      await fetchUsers();
    } catch {
      toast.error("Failed to reject user");
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Permanently delete ${user.name}? This cannot be undone.`)) return;
    setWorking(user.id);
    try {
      await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      toast.info(`Deleted ${user.name}`);
      await fetchUsers();
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setWorking(null);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const counts = {
    all:      users.length,
    pending:  users.filter((u) => u.status === "pending").length,
    approved: users.filter((u) => u.status === "approved").length,
    rejected: users.filter((u) => u.status === "rejected").length,
  };

  const filtered = filter === "all" ? users : users.filter((u) => u.status === filter);

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-400" /> Admin Panel
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage user access to ThoughtStack
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: "all",      label: "Total",    icon: Users,     color: "text-foreground"   },
          { key: "pending",  label: "Pending",  icon: Clock,     color: "text-yellow-400"   },
          { key: "approved", label: "Approved", icon: UserCheck, color: "text-green-400"    },
          { key: "rejected", label: "Rejected", icon: UserX,     color: "text-red-400"      },
        ] as const).map(({ key, label, icon: Icon, color }) => (
          <Card
            key={key}
            className={cn("cursor-pointer transition-all", filter === key && "ring-1 ring-primary")}
            onClick={() => setFilter(key)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={cn("w-5 h-5 shrink-0", color)} />
              <div>
                <p className="text-xl font-bold">{counts[key]}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base capitalize">{filter} users</CardTitle>
          {counts.pending > 0 && filter !== "pending" && (
            <CardDescription className="text-yellow-400">
              ⚠ {counts.pending} pending request{counts.pending > 1 ? "s" : ""} need your attention
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No {filter === "all" ? "" : filter} users yet
            </div>
          ) : (
            filtered.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/30 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{user.name}</p>
                    {user.role === "admin" && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-medium">
                        admin
                      </span>
                    )}
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize",
                      STATUS_STYLE[user.status]
                    )}>
                      {user.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(user.created_at)}
                    </p>
                  </div>
                  {user.approved_by && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {user.status === "approved" ? "Approved" : "Rejected"} by {user.approved_by}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {user.role !== "admin" && (
                  <div className="flex gap-1.5 shrink-0">
                    {user.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(user)}
                          disabled={working === user.id}
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => handleReject(user)}
                          disabled={working === user.id}
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </>
                    )}
                    {user.status === "rejected" && (
                      <Button
                        size="sm"
                        className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApprove(user)}
                        disabled={working === user.id}
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </Button>
                    )}
                    {user.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleReject(user)}
                        disabled={working === user.id}
                      >
                        <X className="w-3.5 h-3.5" /> Revoke
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(user)}
                      disabled={working === user.id}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Users are emailed automatically when approved or rejected via Resend.
      </p>
    </div>
  );
}
