"use client";

import { useState, useRef } from "react";
import { User, Camera, Save, Trophy, CheckSquare, BookOpen, Zap } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const { profile, updateProfile, tasks, journals, skills, events } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: profile.name, email: profile.email, bio: profile.bio ?? "" });
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    updateProfile({ name: form.name, email: form.email, bio: form.bio });
    setEditing(false);
  }

  function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateProfile({ avatar: reader.result as string });
    reader.readAsDataURL(file);
  }

  const stats = [
    { label: "Tasks completed", value: tasks.filter((t) => t.status === "done").length, icon: CheckSquare, color: "text-green-400" },
    { label: "Journal entries", value: journals.length, icon: BookOpen, color: "text-purple-400" },
    { label: "Skills tracked", value: skills.length, icon: Zap, color: "text-yellow-400" },
    { label: "Total XP earned", value: skills.reduce((a, s) => a + s.totalXp, 0), icon: Trophy, color: "text-orange-400" },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <User className="w-6 h-6" /> Profile
      </h1>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Camera className="w-3.5 h-3.5 text-primary-foreground" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>

            {/* Info */}
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                  />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Email address"
                  />
                  <Textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="Tell your story…"
                    className="resize-none h-20"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} className="gap-1">
                      <Save className="w-3.5 h-3.5" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{profile.name || "Your Name"}</h2>
                      <p className="text-sm text-muted-foreground">{profile.email || "No email set"}</p>
                      {profile.bio && <p className="text-sm mt-2 text-muted-foreground">{profile.bio}</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        Member since {formatDate(profile.joinedAt)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
