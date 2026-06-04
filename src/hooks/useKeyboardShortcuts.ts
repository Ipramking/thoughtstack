"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

/**
 * Global keyboard shortcuts.
 * Active app-wide; defers to the focused element if it's editable.
 *
 * Bindings:
 *   /        → focus AI quick-capture (toggle Thoughts panel + focus input)
 *   Cmd/Ctrl+K  → open global search
 *   t        → new task
 *   j        → new journal entry
 *   e        → new calendar event
 *   Esc      → close any open panel (handled per-component too)
 *   Shift+?  → show shortcut help (we surface this in a toast)
 */

function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const toggleThoughtsPanel = useAppStore((s) => s.toggleThoughtsPanel);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't hijack typing
      if (isEditableElement(e.target) && e.key !== "Escape") return;

      const cmd = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K → search
      if (cmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("ts:open-search"));
        return;
      }

      // No-modifier single-key shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "/":
          e.preventDefault();
          toggleThoughtsPanel();
          break;
        case "t":
        case "T":
          // Only when not already on the page (or always — same UX)
          router.push("/tasks?new=1");
          break;
        case "j":
        case "J":
          router.push("/journal?new=1");
          break;
        case "e":
        case "E":
          router.push("/calendar?new=1");
          break;
        case "?":
          document.dispatchEvent(new CustomEvent("ts:show-shortcuts"));
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, toggleThoughtsPanel]);
}
