"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownViewProps {
  content:   string;
  className?: string;
}

/**
 * Renders Markdown using react-markdown + GFM (tables, task lists, strikethrough).
 * Styled to match the app's typography. Use anywhere a journal entry, note,
 * or AI response needs to render formatted text.
 */
export function MarkdownView({ content, className }: MarkdownViewProps) {
  return (
    <div
      className={cn(
        // Compact, readable prose that fits inside cards
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h1:text-xl prose-h1:mt-3 prose-h1:mb-2",
        "prose-h2:text-lg prose-h2:mt-3 prose-h2:mb-1.5",
        "prose-h3:text-base prose-h3:mt-2 prose-h3:mb-1",
        "prose-p:leading-relaxed prose-p:my-1.5",
        "prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0",
        "prose-strong:text-foreground prose-em:text-foreground/90",
        "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none",
        "prose-blockquote:border-l-2 prose-blockquote:border-primary/40 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-muted-foreground",
        "prose-hr:my-3 prose-hr:border-border",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Render task-list checkboxes nicely
          input: (props) =>
            props.type === "checkbox" ? (
              <input {...props} disabled className="mr-1.5 align-middle accent-primary" />
            ) : <input {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
