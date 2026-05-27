"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show,  setShow]  = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Already installed as PWA — never show
    if (isInStandaloneMode()) return;

    // Already dismissed this session
    if (sessionStorage.getItem("pwa-prompt-dismissed")) return;

    const ios = isIOS();
    setIsIos(ios);

    if (ios) {
      // iOS: no auto prompt — show manual instructions after 4s
      const t = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(t);
    }

    // Android / Chrome: wait for browser event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setShow(false);
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 md:left-auto md:right-6 md:w-[340px] animate-slide-up">
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="ThoughtStack" className="w-10 h-10 rounded-xl" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Install ThoughtStack</p>
            <p className="text-xs text-muted-foreground">Add to your home screen</p>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* iOS instructions */}
        {isIos ? (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Follow these steps to install:</p>
            <div className="space-y-2.5">
              {[
                { icon: Share,    step: "1", text: "Tap the Share button at the bottom of Safari" },
                { icon: Plus,     step: "2", text: 'Scroll down and tap "Add to Home Screen"'    },
                { icon: Download, step: "3", text: 'Tap "Add" — ThoughtStack appears on your home screen' },
              ].map(({ icon: Icon, step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
            <button
              onClick={dismiss}
              className="w-full mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 font-medium"
            >
              Got it
            </button>
          </div>
        ) : (
          /* Android / Chrome */
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Install for the full experience — offline support, push reminders, and faster loading.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 text-sm font-semibold py-2.5 px-4 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Install app
              </button>
              <button
                onClick={dismiss}
                className="text-sm font-medium py-2.5 px-4 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground"
              >
                Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
