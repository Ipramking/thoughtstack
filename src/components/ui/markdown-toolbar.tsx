"use client";

import { Bold, Italic, List, Heading2, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}

function wrap(ta: HTMLTextAreaElement, before: string, after = before, placeholder = "text") {
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.substring(start, end) || placeholder;
  const next  = ta.value.substring(0, start) + before + sel + after + ta.value.substring(end);
  return { next, cursor: start + before.length + sel.length + after.length };
}

function insertLine(ta: HTMLTextAreaElement, prefix: string) {
  const start = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd   = ta.value.indexOf("\n", start);
  const line      = ta.value.substring(lineStart, lineEnd === -1 ? undefined : lineEnd);
  // Toggle: if already prefixed, remove; otherwise add
  const already = line.startsWith(prefix);
  const newLine = already ? line.slice(prefix.length) : prefix + line;
  const next    = ta.value.substring(0, lineStart) + newLine + (lineEnd === -1 ? "" : ta.value.substring(lineEnd));
  return { next, cursor: start + (already ? -prefix.length : prefix.length) };
}

export function MarkdownToolbar({ textareaRef, value, onChange }: Props) {
  function apply(fn: (ta: HTMLTextAreaElement) => { next: string; cursor: number }) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { next, cursor } = fn(ta);
    onChange(next);
    // restore cursor after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  }

  const tools = [
    {
      icon: Heading2,
      title: "Heading",
      action: () => apply((ta) => insertLine(ta, "## ")),
    },
    {
      icon: Bold,
      title: "Bold",
      action: () => apply((ta) => wrap(ta, "**", "**", "bold text")),
    },
    {
      icon: Italic,
      title: "Italic",
      action: () => apply((ta) => wrap(ta, "*", "*", "italic text")),
    },
    {
      icon: List,
      title: "Bullet list",
      action: () => apply((ta) => insertLine(ta, "- ")),
    },
    {
      icon: Minus,
      title: "Divider",
      action: () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        const ins = "\n---\n";
        const next = ta.value.substring(0, pos) + ins + ta.value.substring(pos);
        onChange(next);
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(pos + ins.length, pos + ins.length);
        });
      },
    },
  ];

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 rounded-t-xl">
      {tools.map(({ icon: Icon, title, action }) => (
        <button
          key={title}
          type="button"
          title={title}
          onClick={action}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-lg",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors text-sm"
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
      <div className="ml-auto text-[10px] text-muted-foreground/60 pr-1">Markdown</div>
    </div>
  );
}

/** Render markdown to plain HTML for display in journal cards */
export function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm,  '<p class="text-sm font-bold mt-2 mb-0.5">$1</p>')
    .replace(/^# (.+)$/gm,   '<p class="text-base font-bold mt-2 mb-1">$1</p>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/^---$/gm,       '<hr class="border-border my-2" />')
    .replace(/^- (.+)$/gm,    '<span class="flex gap-1.5 items-start"><span class="mt-0.5 shrink-0">•</span><span>$1</span></span>')
    .replace(/\n/g,            '<br />');
}
