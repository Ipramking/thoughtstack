"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { ThoughtsPanel } from "./ThoughtsPanel";
import { MainContentInner } from "./MainContentInner";
import { BottomNav } from "./BottomNav";

const PUBLIC_PATHS = ["/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return;

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

  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <MainContentInner>
        {/* Extra bottom padding on mobile so content clears the bottom nav */}
        <div className="pb-20 md:pb-0 min-h-full">
          {children}
        </div>
      </MainContentInner>
      <ThoughtsPanel />
      {/* Bottom nav — only on mobile */}
      <BottomNav />
    </div>
  );
}
