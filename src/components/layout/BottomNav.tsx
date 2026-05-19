"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, CheckSquare, BookOpen, Zap, Calendar, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const NAV = [
  { href: "/",         icon: Home,        label: "Home"    },
  { href: "/tasks",    icon: CheckSquare, label: "Tasks"   },
  { href: "/journal",  icon: BookOpen,    label: "Journal" },
  { href: "/skills",   icon: Zap,         label: "Skills"  },
  { href: "/calendar", icon: Calendar,    label: "Calendar"},
];

export function BottomNav() {
  const pathname = usePathname();
  const { toggleThoughtsPanel } = useAppStore();

  if (pathname === "/auth") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
            <span className="text-[9px] font-medium">{label}</span>
          </Link>
        );
      })}
      {/* Thoughts AI button */}
      <button
        onClick={toggleThoughtsPanel}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Brain className="w-5 h-5" />
        <span className="text-[9px] font-medium">Thoughts</span>
      </button>
    </nav>
  );
}
