"use client";

import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function MainContentInner({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, thoughtsPanelOpen } = useAppStore();

  return (
    <main
      className={cn(
        "flex-1 min-h-dvh overflow-y-auto overflow-x-hidden transition-[margin] duration-300 ease-in-out",
        /* Mobile: full width + top padding for the fixed top bar (56px = h-14) */
        "ml-0 pt-14",
        /* Desktop: sidebar offset, no top padding */
        "md:pt-0 md:ml-[240px]",
        sidebarCollapsed && "md:ml-[64px]",
        /* Thoughts panel offset (desktop only) */
        thoughtsPanelOpen ? "md:mr-[380px]" : "md:mr-0",
      )}
    >
      {children}
    </main>
  );
}
