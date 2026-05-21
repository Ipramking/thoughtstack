"use client";

import { useState, useRef } from "react";
import { User, Camera, Save, Trophy, CheckSquare, BookOpen, Zap, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/useToast";

export default function ProfilePage() {
  const { profile, updateProfile, tasks, journals, skills } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: profile.name, email: profile.email, bio: profile.bio ?? "" });
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    if (!form.name.trim()) return;
    updateProfile({ name: form.name, email: form.email, bio: form.bio });
    setEditing(false);
    toast.success("Profile updated");
  }

  function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateProfile({ avatar: reader.result as string });
      toast.success("Avatar updated");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-4 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-6 page-enter max-w-2xl">
        <PageHeader
          title="Profile"
          action={
            !editing ? (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditing(true)}>Edit</Button>
            ) : undefined
          }
        />

        {/* Profile card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-muted ring-2 ring-border flex items-center justify-center overflow-hidden">
                  {profile.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-3">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name" className="rounded-xl" autoFocus />
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Email address" className="rounded-xl" />
                    <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder="Tell your story…" className="resize-none h-20 rounded-xl" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave} className="gap-1.5 rounded-xl">
                        <Save className="w-3.5 h-3.5" /> Save
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 rounded-xl"
                        onClick={() => { setEditing(false); setForm({ name: profile.name, email: profile.email, bio: profile.bio ?? "" }); }}>
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold">{profile.name || "Your Name"}</h2>
                    {profile.email && <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>}
                    {profile.bio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{profile.bio}</p>}
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      Member since {formatDate(profile.joinedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 stagger">
          <StatCard label="Tasks completed" value={tasks.filter((t) => t.status === "done").length} icon={CheckSquare} iconColor="text-green-400" />
          <StatCard label="Journal entries"  value={journals.length}                                  icon={BookOpen}    iconColor="text-purple-400" />
          <StatCard label="Skills tracked"   value={skills.length}                                    icon={Zap}         iconColor="text-yellow-400" />
          <StatCard label="Total XP earned"  value={skills.reduce((a, s) => a + s.totalXp, 0)}        icon={Trophy}      iconColor="text-orange-400" />
        </div>
      </div>
    </div>
  );
}
