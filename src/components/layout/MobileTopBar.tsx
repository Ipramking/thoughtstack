"use client";

import { useState } from "react";
import { Menu, Brain, Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/ui/global-search";

const PAGE_TITLES: Record<string, string> = {
  "/":         "Home",
  "/tasks":    "Tasks",
  "/journal":  "Journal",
  "/calendar": "Calendar",
  "/profile":  "Profile",
  "/settings": "Settings",
  "/admin":    "Admin",
};

interface MobileTopBarProps { onMenuClick: () => void }

export function MobileTopBar({ onMenuClick }: MobileTopBarProps) {
  const { toggleThoughtsPanel } = useAppStore();
  const pathname  = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  if (pathname === "/auth") return null;

  const title = PAGE_TITLES[pathname] ?? "ThoughtStack";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 h-14 md:hidden bg-background/95 backdrop-blur-xl border-b border-border flex items-center px-2">
        <button
          onClick={onMenuClick}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <p className="flex-1 text-center text-[15px] font-semibold tracking-tight">{title}</p>

        <button
          onClick={() => setSearchOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          onClick={toggleThoughtsPanel}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          aria-label="Open Thoughts AI"
        >
          <Brain className="w-5 h-5" />
        </button>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
