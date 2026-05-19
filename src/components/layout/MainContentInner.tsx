"use client";

import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function MainContentInner({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, thoughtsPanelOpen } = useAppStore();

  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto transition-all duration-300",
        sidebarCollapsed ? "ml-[60px]" : "ml-[220px]",
        thoughtsPanelOpen ? "mr-[360px]" : "mr-0"
      )}
    >
      {children}
    </main>
  );
}
