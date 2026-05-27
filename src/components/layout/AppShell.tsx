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

const PUBLIC_PATHS = ["/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname   = usePathname();
  const router     = useRouter();
  const isOnline   = useOnlineStatus();
  const { updateProfile, profile } = useAppStore();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Sync auth user into local store when online
  useEffect(() => {
    if (session?.user?.name)  updateProfile({ name:  session.user.name  });
    if (session?.user?.email) updateProfile({ email: session.user.email });
  }, [session, updateProfile]);

  // Auth guard — SKIP redirect when offline so users can access cached data
  useEffect(() => {
    if (status === "loading") return;
    if (isPublic) return;
    if (!isOnline) return;          // offline → keep whatever is in store
    if (!session) {
      router.replace(`/auth?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [session, status, isPublic, pathname, router, isOnline]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Loading spinner — only show when online (offline sessions never resolve)
  if (status === "loading" && !isPublic && isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Offline + no session + not public → show offline shell with store data
  if (!isOnline && !session && !isPublic) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
        <MobileTopBar onMenuClick={() => setMobileSidebarOpen(true)} />
        <MainContentInner>
          <OfflineBanner fullscreen name={profile.name} />
        </MainContentInner>
      </div>
    );
  }

  if (isPublic) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <MobileTopBar onMenuClick={() => setMobileSidebarOpen(true)} />

      <MainContentInner>
        {/* Offline banner at top of content */}
        {!isOnline && <OfflineBanner />}
        {children}
      </MainContentInner>

      <ThoughtsPanel />
      <InstallPrompt />
      <Onboarding />
    </div>
  );
}
