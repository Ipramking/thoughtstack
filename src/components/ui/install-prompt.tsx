"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed or dismissed before
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      localStorage.getItem("pwa-install-dismissed")
    ) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      // Show after a brief delay so it doesn't feel intrusive
      setTimeout(() => setVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleInstall() {
    if (!prompt) return;
    prompt.prompt();
    prompt.userChoice.then((choice) => {
      if (choice.outcome === "accepted") setVisible(false);
    });
  }

  function handleDismiss() {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "1");
  }

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+12px)] left-4 right-4 z-50 md:left-auto md:right-6 md:w-80 animate-slide-up">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-background" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install ThoughtStack</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Add to your home screen for the full app experience — offline support, push reminders, and more.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 text-xs font-semibold py-2 px-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs font-medium py-2 px-3 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
