"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { ThoughtsPanel } from "./ThoughtsPanel";
import { MainContentInner } from "./MainContentInner";
import { BottomNav } from "./BottomNav";
import { useAppStore } from "@/store/useAppStore";

const PUBLIC_PATHS = ["/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router   = useRouter();
  const { updateProfile } = useAppStore();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Sync the authenticated user's name into the local store
  useEffect(() => {
    if (session?.user?.name) {
      updateProfile({ name: session.user.name });
    }
  }, [session, updateProfile]);

  // Guard: if not authenticated and not on a public page, redirect
  useEffect(() => {
    if (status === "loading") return;
    if (!session && !isPublic) {
      router.replace(`/auth?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [session, status, isPublic, pathname, router]);

  // Show nothing while the session is being resolved
  if (status === "loading" && !isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Public routes (auth page) — clean layout, no sidebar
  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — tablet/desktop only */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <MainContentInner>
        {children}
      </MainContentInner>

      <ThoughtsPanel />
      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  );
}
