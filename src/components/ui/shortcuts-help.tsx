"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/"],         label: "Toggle AI quick capture"   },
  { keys: ["⌘", "K"],   label: "Open global search"        },
  { keys: ["T"],         label: "New task"                  },
  { keys: ["J"],         label: "New journal entry"         },
  { keys: ["E"],         label: "New calendar event"        },
  { keys: ["Esc"],       label: "Close any panel"           },
  { keys: ["Shift", "?"], label: "Show this shortcut list"  },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("ts:show-shortcuts", handler);
    return () => document.removeEventListener("ts:show-shortcuts", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" /> Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 pt-2">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex items-center gap-1">
                {keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-1.5 py-0.5 text-[11px] font-medium rounded-md border border-border bg-muted text-foreground min-w-[24px] text-center"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground pt-2">
          Shortcuts are disabled while you&apos;re typing in a field.
        </p>
      </DialogContent>
    </Dialog>
  );
}
