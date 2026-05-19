"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { ThoughtsPanel } from "./ThoughtsPanel";
import { MainContentInner } from "./MainContentInner";

const PUBLIC_PATHS = ["/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Skip guard for public pages
    if (PUBLIC_PATHS.includes(pathname)) return;

    // Read profile from localStorage — if name is still default "User"
    // or unset, the user hasn't completed onboarding yet.
    try {
      const raw = localStorage.getItem("thoughtstack-storage");
      if (!raw) {
        router.replace(`/auth?from=${encodeURIComponent(pathname)}`);
        return;
      }
      const parsed = JSON.parse(raw);
      const name: string = parsed?.state?.profile?.name ?? "";
      if (!name || name === "User") {
        router.replace(`/auth?from=${encodeURIComponent(pathname)}`);
      }
    } catch {
      router.replace(`/auth?from=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  // Auth page → clean full-screen layout (no sidebar, no AI panel)
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <MainContentInner>{children}</MainContentInner>
      <ThoughtsPanel />
    </div>
  );
}
