"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { ThoughtsPanel } from "./ThoughtsPanel";
import { MainContentInner } from "./MainContentInner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Auth page gets a clean full-screen layout — no sidebar, no panel
  if (pathname === "/auth") {
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
