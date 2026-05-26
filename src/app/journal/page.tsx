"use client";

import { useState, useMemo, useRef } from "react";
import {
  Plus, Search, Mic, MicOff, BookOpen, Edit2, Trash2,
  Tag, Brain, Camera, Sparkles, Loader2, ImageIcon,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { JournalEntry, Mood } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { callThoughts } from "@/lib/thoughts-ai";

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: "great",   emoji: "😄", label: "Great"   },
  { value: "good",    emoji: "🙂", label: "Good"    },
  { value: "neutral", emoji: "😐", label: "Okay"    },
  { value: "bad",     emoji: "😕", label: "Bad"     },
  { value: "awful",   emoji: "😞", label: "Awful"   },
];

const MOOD_BG: Record<Mood, string> = {
  great:   "bg-green-500/8  border-green-500/20",
  good:    "bg-blue-500/8   border-blue-500/20",
  neutral: "bg-yellow-500/8 border-yellow-500/20",
  bad:     "bg-orange-500/8 border-orange-500/20",
  awful:   "bg-red-500/8    border-red-500/20",
};

interface FormData {
  title: string; content: string; mood: Mood; tags: string; folder: string;
  photos: string[];
}
const DEFAULT_FORM: FormData = { title: "", content: "", mood: "neutral", tags: "", folder: "", photos: [] };

export default function JournalPage() {
  const { journals, addJournal, updateJournal, deleteJournal, toggleThoughtsPanel, addTask } = useAppStore();

  const [search,         setSearch]     = useState("");
  const [selectedFolder, setFolder]     = useState<string | null>(null);
  const [dialogOpen,     setDialogOpen] = useState(false);
  const [editId,         setEditId]     = useState<string | null>(null);
  const [form,           setForm]       = useState<FormData>(DEFAULT_FORM);
  const [recording,      setRecording]  = useState(false);
  const [analyzing,      setAnalyzing]  = useState(false);

  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<BlobPart[]>([]);
  const cameraRef  = useRef<HTMLInputElement>(null);

  const folders = useMemo(
    () => Array.from(new Set(journals.map((j) => j.folder).filter((f): f is string => Boolean(f)))),
    [journals],
  );

  const filtered = useMemo(() =>
    journals.filter((j) => {
      const q = search.toLowerCase();
      return (
        (j.title.toLowerCase().includes(q) || j.content.toLowerCase().includes(q)) &&
        (!selectedFolder || j.folder === selectedFolder)
      );
    }), [journals, search, selectedFolder]);

  function openCreate() { setEditId(null); setForm(DEFAULT_FORM); setDialogOpen(true); }
  function openEdit(e: JournalEntry) {
    setEditId(e.id);
    setForm({ title: e.title, content: e.content, mood: e.mood ?? "neutral", tags: e.tags.join(", "), folder: e.folder ?? "", photos: e.photos ?? [] });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = { title: form.title, content: form.content, mood: form.mood, tags, folder: form.folder || undefined, photos: form.photos };
    if (editId) {
      updateJournal(editId, payload);
      toast.success("Entry updated");
    } else {
      addJournal(payload);
      toast.success("Entry saved");
    }
    setDialogOpen(false);
  }

  /** Save entry then ask AI to extract tasks / insights */
  async function handleSaveAndAnalyze() {
    if (!form.title.trim() || !form.content.trim()) return;
    handleSave();
    setAnalyzing(true);
    try {
      const prompt = `I just wrote a journal entry titled "${form.title}". Here's the content:\n\n${form.content}\n\nPlease read this and: 1) Give me a brief insight or reflection, 2) Identify any tasks or action items hidden in what I wrote.`;
      const res = await callThoughts(prompt, [], undefined);
      if (res.actions?.length) {
        // Show action suggestions via the AI panel
        toggleThoughtsPanel();
      }
      toast.success("AI analysed your entry — check Thoughts for insights");
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function toggleRecording() {
    if (recording) { mediaRef.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setForm((f) => ({ ...f, content: f.content + (f.content ? "\n\n" : "") + "[Voice note recorded — transcription coming soon]" }));
        toast.info("Voice note added");
      };
      mr.start(); mediaRef.current = mr; setRecording(true);
    } catch { toast.error("Microphone access denied"); }
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Compress to max 800px before storing as base64
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 800;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      canvas.width  = img.width  * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL("image/jpeg", 0.82);
      setForm((f) => ({ ...f, photos: [...f.photos, b64] }));
      URL.revokeObjectURL(url);
      toast.success("Photo attached");
    };
    img.src = url;
    e.target.value = ""; // reset so same file can be picked again
  }

  const moodCounts = MOODS.map((m) => ({ ...m, count: journals.filter((j) => j.mood === m.value).length }));

  return (
    <div className="min-h-screen ambient-bg">
      <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-5 page-enter">
        <PageHeader
          title="Journal"
          subtitle={`${journals.length} ${journals.length === 1 ? "entry" : "entries"}`}
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleThoughtsPanel} className="gap-1.5 rounded-xl">
                <Brain className="w-3.5 h-3.5" /> AI
              </Button>
              <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-xl">
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
            </div>
          }
        />

        {/* Mood overview */}
        {journals.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {moodCounts.filter((m) => m.count > 0).map((m) => (
              <div key={m.value} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border shrink-0">
                <span className="text-xl">{m.emoji}</span>
                <div>
                  <p className="text-sm font-bold leading-none">{m.count}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search + folders */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search entries…" className="pl-9 rounded-xl" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {folders.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFolder(null)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium", !selectedFolder ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>All</button>
              {folders.map((folder) => (
                <button key={folder} onClick={() => setFolder(folder === selectedFolder ? null : folder)}
                  className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium", selectedFolder === folder ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                  {folder}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={search ? "No entries match" : "No journal entries yet"}
            description={!search ? "Write freely — Thoughts AI can extract tasks from your entries." : undefined}
            action={!search ? <Button onClick={openCreate} variant="outline" className="gap-1.5 rounded-xl"><Plus className="w-3.5 h-3.5" /> Write first entry</Button> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
            {filtered.map((entry) => (
              <JournalCard key={entry.id} entry={entry} onEdit={() => openEdit(entry)} onDelete={() => deleteJournal(entry.id)} />
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg rounded-2xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> {editId ? "Edit entry" : "New journal entry"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Entry title…" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" autoFocus />

              {/* Mood */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">How are you feeling?</label>
                <div className="flex gap-2">
                  {MOODS.map((m) => (
                    <button key={m.value} onClick={() => setForm({ ...form, mood: m.value })}
                      className={cn("flex flex-col items-center gap-1 p-2 rounded-xl border transition-all flex-1",
                        form.mood === m.value ? "border-primary bg-primary/10 scale-105" : "border-border hover:bg-muted")}>
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-[9px] text-muted-foreground">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content + mic */}
              <div className="relative">
                <Textarea placeholder="Write your thoughts…" value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="resize-none h-36 pr-12 rounded-xl" />
                <button onClick={toggleRecording}
                  className={cn("absolute right-3 top-3 p-1.5 rounded-lg transition-all touch-target",
                    recording ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground hover:bg-muted")}>
                  {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              {/* Photos */}
              {form.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {form.photos.map((photo, i) => (
                    <div key={i} className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-border" />
                      <button
                        onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-[10px] font-bold"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Camera + tags row */}
              <div className="flex gap-3">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl border border-border hover:bg-muted"
                >
                  <Camera className="w-3.5 h-3.5" /> Add photo
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                <div className="flex-1">
                  <Input placeholder="Tags (comma separated)" value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })} className="rounded-xl text-xs" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Folder</label>
                <Input placeholder="Personal, Work…" value={form.folder}
                  onChange={(e) => setForm({ ...form, folder: e.target.value })} className="rounded-xl" />
              </div>
            </div>
            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button variant="outline" className="rounded-xl gap-1.5" onClick={handleSaveAndAnalyze}
                disabled={!form.title.trim() || !form.content.trim() || analyzing}>
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Save & Analyse
              </Button>
              <Button className="rounded-xl" onClick={handleSave} disabled={!form.title.trim() || !form.content.trim()}>
                Save entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function JournalCard({ entry, onEdit, onDelete }: { entry: JournalEntry; onEdit: () => void; onDelete: () => void }) {
  const mood = MOODS.find((m) => m.value === entry.mood);
  return (
    <div
      className={cn("group rounded-2xl border p-4 cursor-pointer hover:shadow-sm transition-all", entry.mood && MOOD_BG[entry.mood as Mood])}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {mood && <span className="text-xl shrink-0">{mood.emoji}</span>}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold line-clamp-1">{entry.title}</h3>
            <p className="text-[10px] text-muted-foreground">{formatDate(entry.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onEdit}><Edit2 className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>

      {/* Photos strip */}
      {entry.photos && entry.photos.length > 0 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide">
          {entry.photos.slice(0, 3).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-border/40" />
          ))}
          {entry.photos.length > 3 && (
            <div className="w-16 h-16 rounded-lg bg-muted/60 border border-border/40 flex items-center justify-center shrink-0">
              <span className="text-xs text-muted-foreground font-medium">+{entry.photos.length - 3}</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">{entry.content}</p>

      <div className="flex items-center justify-between">
        {entry.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="w-2.5 h-2.5 text-muted-foreground" />
            {entry.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
            ))}
          </div>
        )}
        {entry.photos && entry.photos.length > 0 && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
            <ImageIcon className="w-2.5 h-2.5" /> {entry.photos.length}
          </span>
        )}
      </div>
    </div>
  );
}
