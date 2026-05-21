"use client";

import { useState } from "react";
import {
  Zap, Plus, Trophy, BookOpen, CheckCircle2,
  Lock, Play, Brain, Trash2, Star,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { TrackedSkill, SkillCategory, Mission, SkillModule } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { cn, generateId } from "@/lib/utils";

const SKILL_CATEGORIES: SkillCategory[] = [
  "Web3", "Programming", "UI/UX", "Game Development",
  "Productivity", "Branding & Marketing", "AI Tools Mastery", "Crypto Trading",
];

const CATEGORY_ICONS: Record<SkillCategory, string> = {
  "Web3": "🔗", "Programming": "💻", "UI/UX": "🎨", "Game Development": "🎮",
  "Productivity": "⚡", "Branding & Marketing": "📣", "AI Tools Mastery": "🤖",
  "Crypto Trading": "📈",
};

function generateMissions(name: string, category: SkillCategory): Mission[] {
  const base = [
    { title: `${name} Foundations`, description: `Learn the core concepts of ${name} from scratch`, xp: 100 },
    { title: "First Project", description: `Build your first ${name} project using what you've learned`, xp: 200 },
    { title: "Deep Dive", description: `Explore advanced ${name} concepts and patterns`, xp: 300 },
    { title: "Real World", description: `Apply ${name} to a real-world use case or problem`, xp: 400 },
    { title: "Mastery Challenge", description: `Complete a capstone ${name} challenge to prove your skills`, xp: 500 },
  ];
  return base.map((m, i) => ({
    id: generateId(),
    title: m.title,
    description: m.description,
    xp: m.xp,
    status: i === 0 ? "active" : "locked",
  })) as Mission[];
}

function generateModules(name: string): SkillModule[] {
  const modules = [
    `Introduction to ${name}`,
    `Core ${name} Concepts`,
    `${name} Tools & Environment`,
    `Building with ${name}`,
    `${name} Best Practices`,
    `Advanced ${name} Patterns`,
    `${name} Project Workshop`,
    `${name} Capstone`,
  ];
  return modules.map((title, i) => ({
    id: generateId(),
    title,
    description: `Module ${i + 1} of the ${name} learning path`,
    duration: `${20 + i * 10} min`,
    completed: false,
    order: i + 1,
  }));
}

export default function SkillsPage() {
  const { skills, addSkill, updateSkill, deleteSkill, completeMission, completeModule, toggleThoughtsPanel } = useAppStore();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<TrackedSkill | null>(null);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState<SkillCategory>("Programming");

  function handleAddSkill() {
    if (!newSkillName.trim()) return;
    const skill = addSkill({
      name: newSkillName.trim(),
      category: newSkillCategory,
      description: `Your personalized ${newSkillName} learning path`,
      progress: 0,
      level: 1,
      xp: 0,
      totalXp: 0,
      missions: generateMissions(newSkillName.trim(), newSkillCategory),
      modules: generateModules(newSkillName.trim()),
    });
    setAddOpen(false);
    setNewSkillName("");
    setSelectedSkill(skill);
  }

  if (selectedSkill) {
    const live = skills.find((s) => s.id === selectedSkill.id) ?? selectedSkill;
    return (
      <SkillDetail
        skill={live}
        onBack={() => setSelectedSkill(null)}
        onCompleteMission={(mId) => completeMission(live.id, mId)}
        onCompleteModule={(mId) => completeModule(live.id, mId)}
        onDelete={() => { deleteSkill(live.id); setSelectedSkill(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-4 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-6 page-enter">
      <PageHeader
        title="Skills & Learning"
        subtitle={`${skills.length} skill${skills.length !== 1 ? "s" : ""} tracked · level up every day`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleThoughtsPanel} className="gap-1.5 rounded-xl">
              <Brain className="w-3.5 h-3.5" /> AI
            </Button>
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5 rounded-xl">
              <Plus className="w-3.5 h-3.5" /> Track skill
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {skills.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Skills tracked", value: skills.length, icon: Zap, color: "text-yellow-400" },
            { label: "Total XP", value: skills.reduce((a, s) => a + s.totalXp, 0), icon: Star, color: "text-purple-400" },
            { label: "Missions done", value: skills.reduce((a, s) => a + s.missions.filter((m) => m.status === "completed").length, 0), icon: Trophy, color: "text-green-400" },
            { label: "Modules done", value: skills.reduce((a, s) => a + s.modules.filter((m) => m.completed).length, 0), icon: BookOpen, color: "text-blue-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-3 flex items-center gap-3">
                <Icon className={cn("w-5 h-5 shrink-0", color)} />
                <div>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Skill cards */}
      {skills.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium mb-1">No skills tracked yet</p>
          <p className="text-sm mb-6">Pick a skill and Thoughts will generate missions and classes for you.</p>
          <Button onClick={() => setAddOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Track your first skill
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <Card
              key={skill.id}
              className="cursor-pointer hover:border-border/60 transition-all group"
              onClick={() => setSelectedSkill(skill)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">
                      {CATEGORY_ICONS[skill.category]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{skill.name}</h3>
                      <p className="text-xs text-muted-foreground">{skill.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-yellow-400">Lv.{skill.level}</p>
                    <p className="text-[10px] text-muted-foreground">{skill.xp} XP</p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{skill.progress}%</span>
                  </div>
                  <Progress value={skill.progress} className="h-2" />
                </div>

                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>
                    <Trophy className="w-3 h-3 inline mr-1 text-yellow-400" />
                    {skill.missions.filter((m) => m.status === "completed").length}/{skill.missions.length} missions
                  </span>
                  <span>
                    <BookOpen className="w-3 h-3 inline mr-1 text-blue-400" />
                    {skill.modules.filter((m) => m.completed).length}/{skill.modules.length} modules
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add skill dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Track a new skill
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Thoughts will generate a personalized mission plan and learning modules for you.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Skill name</label>
              <Input
                placeholder="e.g. React, Figma, Solidity…"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <Select value={newSkillCategory} onValueChange={(v) => setNewSkillCategory(v as SkillCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_ICONS[c]} {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSkill} disabled={!newSkillName.trim()}>
              <Zap className="w-4 h-4 mr-1" /> Start tracking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

function SkillDetail({
  skill, onBack, onCompleteMission, onCompleteModule, onDelete,
}: {
  skill: TrackedSkill;
  onBack: () => void;
  onCompleteMission: (id: string) => void;
  onCompleteModule: (id: string) => void;
  onDelete: () => void;
}) {
  const MISSION_STATUS_ICON = {
    locked: <Lock className="w-4 h-4 text-muted-foreground" />,
    active: <Play className="w-4 h-4 text-blue-400" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  };

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 pt-4 pb-nav sm:px-6 sm:pt-6 md:pb-6 space-y-6 page-enter">
      <PageHeader
        title={skill.name}
        subtitle={skill.category}
        onBack={onBack}
        action={
          <Button variant="ghost" size="icon" onClick={onDelete} className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        }
      />

      {/* XP card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-3xl font-bold">{skill.xp} XP</p>
              <p className="text-xs text-muted-foreground">Level {skill.level} · {skill.totalXp} total XP earned</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-yellow-400">Level {skill.level}</p>
              <p className="text-xs text-muted-foreground">{500 - (skill.xp % 500)} XP to next level</p>
            </div>
          </div>
          <Progress value={skill.progress} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1.5">{skill.progress}% complete</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="missions">
        <TabsList>
          <TabsTrigger value="missions">Missions</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
        </TabsList>

        <TabsContent value="missions" className="mt-4 space-y-3">
          {skill.missions.map((mission) => (
            <Card key={mission.id} className={cn(mission.status === "locked" && "opacity-60")}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="mt-0.5">{MISSION_STATUS_ICON[mission.status]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{mission.title}</h3>
                    <span className="text-[10px] text-yellow-400 font-bold">+{mission.xp} XP</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{mission.description}</p>
                </div>
                {mission.status === "active" && (
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() => onCompleteMission(mission.id)}
                  >
                    Complete
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="modules" className="mt-4 space-y-3">
          {skill.modules.map((mod) => (
            <Card key={mod.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  {mod.order}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", mod.completed && "line-through text-muted-foreground")}>
                    {mod.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{mod.duration}</p>
                </div>
                {mod.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                ) : (
                  <Button size="sm" variant="outline" onClick={() => onCompleteModule(mod.id)}>
                    Done
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
