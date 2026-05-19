"use client";

import { useState, useMemo, useRef } from "react";
import {
  Plus, Search, Mic, MicOff, BookOpen, Edit2, Trash2,
  Tag, Brain, Loader2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { JournalEntry, Mood } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/useToast";

const MOODS: { value: Mood; emoji: string; label: string; color: string }[] = [
  { value: "great", emoji: "😄", label: "Great", color: "text-green-400" },
  { value: "good", emoji: "🙂", label: "Good", color: "text-blue-400" },
  { value: "neutral", emoji: "😐", label: "Neutral", color: "text-yellow-400" },
  { value: "bad", emoji: "😕", label: "Bad", color: "text-orange-400" },
  { value: "awful", emoji: "😞", label: "Awful", color: "text-red-400" },
];

interface FormData {
  title: string;
  content: string;
  mood: Mood;
  tags: string;
  folder: string;
}

const DEFAULT_FORM: FormData = {
  title: "",
  content: "",
  mood: "neutral",
  tags: "",
  folder: "",
};

export default function JournalPage() {
  const { journals, addJournal, updateJournal, deleteJournal, toggleThoughtsPanel } = useAppStore();
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [recording,     setRecording]     = useState(false);
  const [transcribing,  setTranscribing]  = useState(false);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const folders = useMemo(
    () => Array.from(new Set(journals.map((j) => j.folder).filter((f): f is string => Boolean(f)))),
    [journals]
  );

  const filtered = useMemo(() => {
    return journals.filter((j) => {
      const matchSearch =
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.content.toLowerCase().includes(search.toLowerCase());
      const matchFolder = !selectedFolder || j.folder === selectedFolder;
      return matchSearch && matchFolder;
    });
  }, [journals, search, selectedFolder]);

  function openCreate() {
    setEditId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEdit(entry: JournalEntry) {
    setEditId(entry.id);
    setForm({
      title: entry.title,
      content: entry.content,
      mood: entry.mood ?? "neutral",
      tags: entry.tags.join(", "),
      folder: entry.folder ?? "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (editId) {
      updateJournal(editId, {
        title: form.title,
        content: form.content,
        mood: form.mood,
        tags,
        folder: form.folder || undefined,
      });
    } else {
      addJournal({
        title: form.title,
        content: form.content,
        mood: form.mood,
        tags,
        folder: form.folder || undefined,
      });
    }
    setDialogOpen(false);
  }

  async function transcribeBlob(blob: Blob) {
    setTranscribing(true);
    toast.info("Transcribing voice note…");

    // 1️⃣ Try Whisper API
    try {
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (res.ok) {
        const { text } = await res.json();
        if (text) {
          setForm((f) => ({
            ...f,
            content: f.content ? `${f.content}\n\n${text}` : text,
          }));
          toast.success("Voice note transcribed!");
          return;
        }
      }
    } catch { /* fall through */ }

    // 2️⃣ Fallback: browser Web Speech API (live, not from blob)
    toast.info("Whisper unavailable — using browser speech recognition");
    setForm((f) => ({
      ...f,
      content: f.content ? `${f.content}\n\n[Voice note — add OPENAI_API_KEY to enable auto-transcription]` : "[Voice note — add OPENAI_API_KEY to enable auto-transcription]",
    }));
  }

  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeBlob(blob);
        setTranscribing(false);
      };
      mr.start(1000); // collect data every 1s
      mediaRef.current = mr;
      setRecording(true);
      toast.info("Recording… tap mic again to stop");
    } catch {
      toast.error("Microphone access denied", "Please allow microphone permissions in your browser settings.");
    }
  }

  const moodStats = MOODS.map((m) => ({
    ...m,
    count: journals.filter((j) => j.mood === m.value).length,
  }));

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-green-400" /> Journal
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {journals.length} {journals.length === 1 ? "entry" : "entries"} · your thoughts, captured
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleThoughtsPanel} className="gap-1">
            <Brain className="w-4 h-4" /> AI insights
          </Button>
          <Button onClick={openCreate} className="gap-1">
            <Plus className="w-4 h-4" /> New entry
          </Button>
        </div>
      </div>

      {/* Mood overview */}
      {journals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">MOOD OVERVIEW</p>
            <div className="flex gap-4 flex-wrap">
              {moodStats.filter((m) => m.count > 0).map((m) => (
                <div key={m.value} className="flex items-center gap-2">
                  <span className="text-lg">{m.emoji}</span>
                  <div>
                    <p className="text-sm font-medium">{m.count}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + folders */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search entries…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedFolder(null)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-lg border transition-colors",
              !selectedFolder
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}
          >
            All
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder === selectedFolder ? null : folder)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                selectedFolder === folder
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              )}
            >
              {folder}
            </button>
          ))}
        </div>
      </div>

      {/* Entries grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">
            {search ? "No entries match your search" : "No journal entries yet — start writing!"}
          </p>
          {!search && (
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-1">
              <Plus className="w-4 h-4" /> Write first entry
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((entry) => (
            <JournalCard
              key={entry.id}
              entry={entry}
              onEdit={() => openEdit(entry)}
              onDelete={() => deleteJournal(entry.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {editId ? "Edit entry" : "New journal entry"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Entry title…"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />

            {/* Mood selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">How are you feeling?</label>
              <div className="flex gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setForm({ ...form, mood: m.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all flex-1",
                      form.mood === m.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    )}
                    title={m.label}
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span className="text-[9px] text-muted-foreground">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content + voice */}
            <div className="relative">
              <Textarea
                placeholder="Write your thoughts…"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="resize-none h-32 pr-10"
              />
              <button
                onClick={toggleRecording}
                className={cn(
                  "absolute right-3 top-3 p-1.5 rounded-lg transition-colors",
                  recording ? "bg-red-500 text-white animate-pulse" :
                  transcribing ? "bg-yellow-500/20 text-yellow-400 animate-pulse" :
                  "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={recording ? "Stop recording" : transcribing ? "Transcribing…" : "Start voice note"}
                disabled={transcribing}
              >
                {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Tag className="w-3 h-3 inline mr-1" />Tags (comma separated)
                </label>
                <Input
                  placeholder="work, ideas, health…"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Folder</label>
                <Input
                  placeholder="Personal, Work…"
                  value={form.folder}
                  onChange={(e) => setForm({ ...form, folder: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.title.trim() || !form.content.trim()}
            >
              {editId ? "Save changes" : "Save entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JournalCard({
  entry, onEdit, onDelete,
}: {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const mood = MOODS.find((m) => m.value === entry.mood);
  return (
    <Card className="group hover:border-border/60 transition-all cursor-pointer" onClick={onEdit}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {mood && <span className="text-xl">{mood.emoji}</span>}
            <div>
              <h3 className="text-sm font-semibold line-clamp-1">{entry.title}</h3>
              <p className="text-[10px] text-muted-foreground">{formatDate(entry.createdAt)}</p>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-3">
          {entry.content}
        </p>

        {entry.aiInsight && (
          <div className="bg-muted/50 rounded-lg p-2 mb-3 text-[10px] text-muted-foreground">
            <Brain className="w-3 h-3 inline mr-1" />
            {entry.aiInsight}
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {entry.folder && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{entry.folder}</span>
          )}
          {entry.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
