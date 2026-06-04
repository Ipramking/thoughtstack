"use client";

import { useSession }                     from "next-auth/react";
import { usePathname, useRouter }          from "next/navigation";
import { useEffect, useState }             from "react";
import { Sidebar }                         from "./Sidebar";
import { MobileTopBar }                    from "./MobileTopBar";
import { ThoughtsPanel }                   from "./ThoughtsPanel";
import { MainContentInner }                from "./MainContentInner";
import { InstallPrompt }                   from "@/components/ui/install-prompt";
import { OfflineBanner }                   from "@/components/ui/offline-banner";
import { Onboarding }                      from "@/components/ui/onboarding";
import { useAppStore }                     from "@/store/useAppStore";
import { useOnlineStatus }                 from "@/hooks/useOnlineStatus";
import { useSyncData }                     from "@/hooks/useSyncData";
import { useReminderScheduler }            from "@/hooks/useReminderScheduler";
import { useKeyboardShortcuts }            from "@/hooks/useKeyboardShortcuts";
import { useBackgroundSync }               from "@/hooks/useBackgroundSync";
import { ShortcutsHelp }                   from "@/components/ui/shortcuts-help";
import { FocusTimerBadge }                 from "@/components/ui/focus-timer";

// Routes that completely bypass the app shell (no sidebar, no sync hooks, no anything).
// /reset must work even when the rest of the app is frozen — it's the rescue route.
const PUBLIC_PATHS = ["/auth", "/reset"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname   = usePathname();
  const router     = useRouter();
  const isOnline   = useOnlineStatus();
  const updateProfile = useAppStore((s) => s.updateProfile);
  const totalItems    = useAppStore((s) => s.tasks.length + s.journals.length + s.events.length);
  useSyncData();             // periodic background sync (now throttled to 5 min)
  useReminderScheduler();    // re-arm task reminders (every 15 min)
  useKeyboardShortcuts();    // / for AI, Cmd+K for search, T/J/E for new items
  useBackgroundSync();       // register SyncManager so SW gets a sync event on reconnect

  // Emergency safety: if dataset is huge (from the legacy duplication bug),
  // auto-dedupe on first mount so the app doesn't choke loading 10,000+ items.
  useEffect(() => {
    if (totalItems < 1000) return;
    const store = useAppStore.getState();
    const removed = store.dedupTasks() + store.dedupJournals() + store.dedupEvents();
    if (removed > 0) {
      console.warn(`[AppShell] Auto-removed ${removed} duplicates (had ${totalItems} items)`);
    }
    // Run only once per mount — checking totalItems again would re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Sync auth user name/email into local store
  useEffect(() => {
    if (session?.user?.name)  updateProfile({ name:  session.user.name  });
    if (session?.user?.email) updateProfile({ email: session.user.email });
  }, [session, updateProfile]);

  // Auth guard — only redirects when ONLINE and session has resolved
  useEffect(() => {
    if (isPublic) return;
    if (status === "loading") return;
    if (!isOnline) return;   // offline → never redirect; local data is the source of truth
    if (!session) {
      router.replace(`/auth?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [session, status, isPublic, pathname, router, isOnline]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // ── Public routes (auth page, etc.) ──────────────────────────────────────────
  if (isPublic) return <>{children}</>;

  // ── Loading spinner — only while waiting for session resolution ONLINE ────────
  // Offline: session either resolves from SW cache or stays null.
  // Either way we show the app — no spinner needed offline.
  if (status === "loading" && isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Full app shell — works online and offline ─────────────────────────────────
  // When offline the user's Zustand data (persisted to localStorage) is still
  // available, so tasks / journal / calendar all render normally.
  // We just show the offline banner and disable AI + sync.
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <MobileTopBar onMenuClick={() => setMobileSidebarOpen(true)} />

      <MainContentInner>
        {/* Offline banner — inline at the top, doesn't block content */}
        {!isOnline && <OfflineBanner />}
        {children}
      </MainContentInner>

      {/* AI panel — only render when online (avoids pointless API calls) */}
      {isOnline && <ThoughtsPanel />}

      <InstallPrompt />

      {/* Onboarding — show even offline if session is present */}
      {(session || !isOnline) && <Onboarding />}

      <ShortcutsHelp />
      <FocusTimerBadge />
    </div>
  );
}
