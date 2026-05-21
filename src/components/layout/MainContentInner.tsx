"use client";

import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function MainContentInner({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, thoughtsPanelOpen } = useAppStore();

  return (
    <main
      className={cn(
        "flex-1 min-h-dvh overflow-y-auto overflow-x-hidden transition-[margin] duration-300 ease-in-out",
        /* Mobile: always full width — no sidebar offset */
        "ml-0 mr-0",
        /* md+: sidebar offset */
        "md:ml-[220px]",
        sidebarCollapsed && "md:ml-[60px]",
        /* md+: thoughts panel offset */
        thoughtsPanelOpen ? "md:mr-[360px]" : "md:mr-0"
      )}
    >
      {children}
    </main>
  );
}
