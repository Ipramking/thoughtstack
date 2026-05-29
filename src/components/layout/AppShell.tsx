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

const PUBLIC_PATHS = ["/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname   = usePathname();
  const router     = useRouter();
  const isOnline   = useOnlineStatus();
  const { updateProfile } = useAppStore();
  useSyncData(); // cross-device sync — pull on mount, push on focus/interval

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
    </div>
  );
}
