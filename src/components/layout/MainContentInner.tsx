"use client";

import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function MainContentInner({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, thoughtsPanelOpen } = useAppStore();

  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto transition-all duration-300",
        // On mobile: no sidebar margin. On md+: respect sidebar width.
        "ml-0",
        "md:ml-[220px]",
        sidebarCollapsed && "md:ml-[60px]",
        thoughtsPanelOpen ? "mr-[360px]" : "mr-0"
      )}
    >
      {children}
    </main>
  );
}
