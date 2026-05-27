"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  Plus, Search, BookOpen, Edit2, Trash2, Tag, Brain,
  Camera, Sparkles, Loader2, Mic, MicOff, Square,
  Bold, Italic, List, Heading2, Minus, X, LayoutTemplate, ChevronDown,
} from "lucide-react";
import { useAppStore }     from "@/store/useAppStore";
import { JournalEntry, Mood } from "@/types";
import { Button }          from "@/components/ui/button";
import { Input }           from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader }      from "@/components/ui/page-header";
import { EmptyState }      from "@/components/ui/empty-state";
import { cn, formatDate }  from "@/lib/utils";
import { toast }           from "@/hooks/useToast";
import { callThoughts }    from "@/lib/thoughts-ai";

// ── Journal templates ─────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: "Daily check-in",
    title: `Daily check-in — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
    content: `## How I'm feeling\n\n\n## What I accomplished today\n- \n\n## What's on my mind\n\n\n## Tomorrow's intention\n`,
  },
  {
    label: "Weekly review",
    title: `Weekly review — W${Math.ceil(new Date().getDate() / 7)} ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    content: `## Wins this week\n- \n\n## What didn't go well\n- \n\n## What I learned\n\n\n## Goals for next week\n1. \n2. \n3. \n`,
  },
  {
    label: "Gratitude",
    title: `Gratitude — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`,
    content: `## Three things I'm grateful for\n1. \n2. \n3. \n\n## One person I appreciate today\n\n\n## Something small that made me smile\n`,
  },
  {
    label: "Brain dump",
    title: "Brain dump",
    content: `## Everything on my mind right now\n\n\n## Tasks hiding in the above\n- \n\n## How I feel after writing this\n`,
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────
const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: "great",   emoji: "😄", label: "Great"  },
  { value: "good",    emoji: "🙂", label: "Good"   },
  { value: "neutral", emoji: "😐", label: "Okay"   },
  { value: "bad",     emoji: "😕", label: "Bad"    },
  { value: "awful",   emoji: "😞", label: "Awful"  },
];
const MOOD_BG: Record<Mood, string> = {
  great:   "bg-green-500/8 border-green-500/20",
  good:    "bg-blue-500/8 border-blue-500/20",
  neutral: "bg-yellow-500/8 border-yellow-500/20",
  bad:     "bg-orange-500/8 border-orange-500/20",
  awful:   "bg-red-500/8 border-red-500/20",
};

interface FormData { title: string; content: string; mood: Mood; tags: string; folder: string; photos: string[] }
const DEFAULT_FORM: FormData = { title: "", content: "", mood: "neutral", tags: "", folder: "", photos: [] };

// ── Markdown renderer (simple subset) ─────────────────────────────────────────
function renderMarkdown(text: string) {
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-2 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-lg font-bold mt-2 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-xl font-bold mt-2 mb-1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/^- (.+)$/gm,   '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm,'<li class="ml-4 list-decimal">$1</li>')
    .replace(/^---$/gm,       '<hr class="my-2 border-border" />')
    .replace(/\n/g,           '<br />');
}

// ── Speech recognition types (not in all TS lib builds) ──────────────────────
interface SR extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror:  ((e: Event) => void) | null;
  onend:    (() => void) | null;
}
interface SRResult { transcript: string; confidence: number }
interface SRResultList { readonly length: number; [i: number]: { isFinal: boolean; [j: number]: SRResult } }
interface SREvent extends Event { readonly resultIndex: number; readonly results: SRResultList }
interface SRConstructor { new (): SR }

function getSR(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as typeof window & { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor })
    .SpeechRecognition ??
    (window as typeof window & { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition ??
    null;
}

// ── Voice-to-text hook ────────────────────────────────────────────────────────
type VoiceState = "idle" | "listening" | "unsupported";

function useVoiceToText(onTranscript: (text: string, isFinal: boolean) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const recogRef = useRef<SR | null>(null);
  const isSupported = !!getSR();

  const start = useCallback(() => {
    const SRClass = getSR();
    if (!SRClass) { setState("unsupported"); return; }
    const rec = new SRClass();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = "en-US";

    rec.onresult = (e: SREvent) => {
      let interim = ""; let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else                       interim   += e.results[i][0].transcript;
      }
      if (finalText) onTranscript(finalText, true);
      else if (interim) onTranscript(interim, false);
    };
    rec.onerror = () => { setState("idle"); toast.error("Voice recognition error"); };
    rec.onend   = () => setState("idle");

    rec.start();
    recogRef.current = rec;
    setState("listening");
  }, [onTranscript]);

  const stop = useCallback(() => { recogRef.current?.stop(); setState("idle"); }, []);
  useEffect(() => () => recogRef.current?.stop(), []);

  return { state, start, stop, isSupported };
}

// ── Formatting toolbar helper ─────────────────────────────────────────────────
function applyFormat(
  textarea: HTMLTextAreaElement,
  type: "bold" | "italic" | "h1" | "h2" | "bullet" | "numbered" | "divider",
): string {
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const val   = textarea.value;
  const sel   = val.substring(start, end);
  const line  = val.lastIndexOf("\n", start - 1) + 1;

  let before = "", after = "", insert = "", cursor = 0;

  switch (type) {
    case "bold":     before = "**"; after = "**"; insert = before + (sel || "bold") + after; cursor = start + 2; break;
    case "italic":   before = "*";  after = "*";  insert = before + (sel || "italic") + after; cursor = start + 1; break;
    case "h1":       insert = "# " + (sel || "Heading"); cursor = start + 2; break;
    case "h2":       insert = "## " + (sel || "Heading"); cursor = start + 3; break;
    case "bullet":   insert = "- " + (sel || ""); cursor = start + 2; break;
    case "numbered": insert = "1. " + (sel || ""); cursor = start + 3; break;
    case "divider":  insert = "\n---\n"; cursor = start + 5; break;
  }

  const newVal = type === "h1" || type === "h2" || type === "bullet" || type === "numbered"
    ? val.substring(0, line) + insert + val.substring(end)
    : val.substring(0, start) + insert + val.substring(end);

  setTimeout(() => {
    textarea.focus();
    const pos = (type === "bold" || type === "italic") ? (sel ? start : cursor) : cursor;
    textarea.setSelectionRange(pos, pos + (sel ? sel.length : 0));
  }, 10);

  return newVal;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const { journals, addJournal, updateJournal, deleteJournal, toggleThoughtsPanel } = useAppStore();

  const [search,     setSearch]     = useState("");
  const [folder,     setFolder]     = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,       setForm]       = useState<FormData>(DEFAULT_FORM);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [preview,    setPreview]    = useState(false);
  const [showTpls,   setShowTpls]   = useState(false);

  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const cameraRef    = useRef<HTMLInputElement>(null);
  const interimRef   = useRef(""); // interim voice text buffer

  // ── Voice-to-text ──────────────────────────────────────────────────────────
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      interimRef.current = "";
      setForm((f) => ({ ...f, content: f.content + (f.content ? " " : "") + text }));
    } else {
      interimRef.current = text;
    }
  }, []);

  const { state: voiceState, start: startVoice, stop: stopVoice, isSupported: voiceSupported } =
    useVoiceToText(handleTranscript);

  // ── Toolbar ────────────────────────────────────────────────────────────────
  function handleFormat(type: Parameters<typeof applyFormat>[1]) {
    const ta = textareaRef.current;
    if (!ta) return;
    const newVal = applyFormat(ta, type);
    setForm((f) => ({ ...f, content: newVal }));
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 800;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL("image/jpeg", 0.82);
      setForm((f) => ({ ...f, photos: [...f.photos, b64] }));
      URL.revokeObjectURL(url);
      toast.success("Photo attached");
    };
    img.src = url;
    e.target.value = "";
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = { title: form.title, content: form.content, mood: form.mood, tags, folder: form.folder || undefined, photos: form.photos };
    if (editId) { updateJournal(editId, payload); toast.success("Entry updated"); }
    else        { addJournal(payload);             toast.success("Entry saved");   }
    setDialogOpen(false);
  }

  // ── Save & Analyse ─────────────────────────────────────────────────────────
  async function handleSaveAndAnalyze() {
    if (!form.title.trim() || !form.content.trim()) return;
    handleSave();
    setAnalyzing(true);
    try {
      const prompt = `Journal entry titled "${form.title}":\n\n${form.content}\n\nGive a brief insight and identify any hidden tasks or commitments.`;
      const res = await callThoughts(prompt, [], undefined);
      if (res.actions?.length) toggleThoughtsPanel();
      toast.success("AI analysed your entry — check Thoughts for insights");
    } catch {
      toast.error("Analysis failed — check your connection");
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Dialog ─────────────────────────────────────────────────────────────────
  function openCreate() { setEditId(null); setForm(DEFAULT_FORM); setPreview(false); setDialogOpen(true); }
  function openEdit(e: JournalEntry) {
    setEditId(e.id);
    setForm({ title: e.title, content: e.content, mood: e.mood ?? "neutral", tags: e.tags.join(", "), folder: e.folder ?? "", photos: e.photos ?? [] });
    setPreview(false);
    setDialogOpen(true);
  }
  function closeDialog() { stopVoice(); setDialogOpen(false); }

  const folders = useMemo(() => Array.from(new Set(journals.map((j) => j.folder).filter(Boolean) as string[])), [journals]);
  const filtered = useMemo(() =>
    journals.filter((j) => {
      const q = search.toLowerCase();
      return (j.title.toLowerCase().includes(q) || j.content.toLowerCase().includes(q)) &&
             (!folder || j.folder === folder);
    }), [journals, search, folder]);
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
              <button onClick={() => setFolder(null)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium", !folder ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>All</button>
              {folders.map((f) => (
                <button key={f} onClick={() => setFolder(f === folder ? null : f)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium", folder === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>{f}</button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={search ? "No entries match" : "No journal entries yet"}
            description={!search ? "Start writing — your thoughts, feelings, wins, anything." : undefined}
            action={!search ? <Button onClick={openCreate} variant="outline" className="gap-1.5 rounded-xl"><Plus className="w-3.5 h-3.5" /> Write first entry</Button> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {filtered.map((entry) => (
              <JournalCard key={entry.id} entry={entry} onEdit={() => openEdit(entry)} onDelete={() => deleteJournal(entry.id)} />
            ))}
          </div>
        )}

        {/* ── Dialog ── */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent className="max-w-2xl rounded-2xl max-h-[92dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {editId ? "Edit entry" : "New journal entry"}
                </span>
                {!editId && (
                  <div className="relative">
                    <button
                      onClick={() => setShowTpls((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-xl border border-border hover:bg-muted"
                    >
                      <LayoutTemplate className="w-3.5 h-3.5" /> Templates <ChevronDown className="w-3 h-3" />
                    </button>
                    {showTpls && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                        {TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.label}
                            onClick={() => {
                              setForm((f) => ({ ...f, title: tpl.title, content: tpl.content }));
                              setShowTpls(false);
                            }}
                            className="w-full text-left px-3 py-2.5 text-xs hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Title */}
              <Input
                placeholder="Entry title…"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl font-medium"
                autoFocus
              />

              {/* Mood */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">How are you feeling?</label>
                <div className="flex gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setForm({ ...form, mood: m.value })}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all flex-1 hover:scale-105",
                        form.mood === m.value ? "border-primary bg-primary/10 scale-105" : "border-border hover:bg-muted",
                      )}
                    >
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-[9px] text-muted-foreground">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rich text toolbar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Content</label>
                  <button
                    onClick={() => setPreview((v) => !v)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded-md border border-border"
                  >
                    {preview ? "Edit" : "Preview"}
                  </button>
                </div>

                {/* Formatting toolbar */}
                {!preview && (
                  <div className="flex items-center gap-0.5 mb-2 p-1 bg-muted rounded-xl flex-wrap">
                    {[
                      { icon: Bold,     type: "bold"     as const, tip: "Bold (**text**)"    },
                      { icon: Italic,   type: "italic"   as const, tip: "Italic (*text*)"    },
                      { icon: Heading2, type: "h2"       as const, tip: "Heading"            },
                      { icon: List,     type: "bullet"   as const, tip: "Bullet list"        },
                      { icon: Minus,    type: "divider"  as const, tip: "Divider"            },
                    ].map(({ icon: Icon, type, tip }) => (
                      <button
                        key={type}
                        onClick={() => handleFormat(type)}
                        title={tip}
                        className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}

                    {/* Divider */}
                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Voice-to-text */}
                    <button
                      onClick={voiceState === "listening" ? stopVoice : startVoice}
                      title={!voiceSupported ? "Voice not supported on this browser" : voiceState === "listening" ? "Stop listening" : "Voice to text"}
                      disabled={!voiceSupported}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-xs font-medium",
                        voiceState === "listening"
                          ? "bg-red-500/20 text-red-400 animate-pulse"
                          : "hover:bg-background text-muted-foreground hover:text-foreground",
                        !voiceSupported && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      {voiceState === "listening"
                        ? <><Square className="w-3.5 h-3.5" /> Stop</>
                        : <><Mic   className="w-3.5 h-3.5" /> Voice</>
                      }
                    </button>

                    {/* Camera */}
                    <button
                      onClick={() => cameraRef.current?.click()}
                      title="Attach photo"
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-background transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Camera className="w-3.5 h-3.5" /> Photo
                    </button>
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                  </div>
                )}

                {/* Voice listening indicator */}
                {voiceState === "listening" && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-xl mb-2 border border-red-500/20">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                    <p className="text-xs text-red-400 font-medium">Listening… speak clearly and I&apos;ll transcribe</p>
                    <button onClick={stopVoice} className="ml-auto text-red-400 hover:text-red-300">
                      <MicOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Textarea / Preview */}
                {preview ? (
                  <div
                    className="min-h-[140px] max-h-[300px] overflow-y-auto rounded-xl border border-border bg-muted/20 px-3.5 py-3 text-sm leading-relaxed prose-sm prose dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) || '<p class="text-muted-foreground">Nothing to preview yet…</p>' }}
                  />
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="Write your thoughts… (supports **bold**, *italic*, # heading, - bullets)"
                    rows={6}
                    className={cn(
                      "w-full resize-none rounded-xl border border-border bg-transparent",
                      "px-3.5 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/60",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                      "min-h-[140px] scrollbar-hide transition-all",
                    )}
                  />
                )}
              </div>

              {/* Photos strip */}
              {form.photos.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Photos ({form.photos.length})</label>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {form.photos.map((photo, i) => (
                      <div key={i} className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="" className="w-20 h-20 object-cover rounded-xl border border-border" />
                        <button
                          onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags + folder */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1 block">
                    <Tag className="w-3 h-3" /> Tags
                  </label>
                  <Input placeholder="work, ideas…" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Folder</label>
                  <Input placeholder="Personal, Work…" value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} className="rounded-xl" />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" className="rounded-xl" onClick={closeDialog}>Cancel</Button>
              <Button
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={handleSaveAndAnalyze}
                disabled={!form.title.trim() || !form.content.trim() || analyzing}
              >
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Save &amp; Analyse
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

// ── Journal card ──────────────────────────────────────────────────────────────
function JournalCard({ entry, onEdit, onDelete }: { entry: JournalEntry; onEdit: () => void; onDelete: () => void }) {
  const mood = MOODS.find((m) => m.value === entry.mood);
  return (
    <div
      className={cn(
        "group cursor-pointer rounded-2xl border transition-all hover:shadow-md",
        entry.mood && MOOD_BG[entry.mood as Mood],
      )}
      onClick={onEdit}
    >
      <div className="p-4">
        {/* Header */}
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
              <img key={i} src={p} alt="" className="w-16 h-16 object-cover rounded-xl border border-border/50 shrink-0" />
            ))}
            {entry.photos.length > 3 && (
              <div className="w-16 h-16 rounded-xl bg-muted border border-border/50 flex items-center justify-center shrink-0">
                <span className="text-xs text-muted-foreground font-medium">+{entry.photos.length - 3}</span>
              </div>
            )}
          </div>
        )}

        {/* Content preview */}
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-3">
          {entry.content.replace(/[#*_`>\-]/g, "").substring(0, 200)}
        </p>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {entry.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded-md">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
