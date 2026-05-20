"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, BookOpen, Zap, Calendar, Brain } from "lucide-react";
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
  const pathname           = usePathname();
  const { toggleThoughtsPanel } = useAppStore();

  if (pathname === "/auth") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl safe-area-bottom">
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] transition-colors",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <div className={cn(
              "p-1 rounded-lg transition-all",
              active && "bg-primary/10"
            )}>
              <Icon className={cn("w-5 h-5 transition-all", active && "stroke-[2.5]")} />
            </div>
            <span className={cn(
              "text-[9px] font-medium transition-all",
              active ? "opacity-100" : "opacity-60"
            )}>
              {label}
            </span>
          </Link>
        );
      })}

      {/* Thoughts AI */}
      <button
        onClick={toggleThoughtsPanel}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="p-1 rounded-lg">
          <Brain className="w-5 h-5" />
        </div>
        <span className="text-[9px] font-medium opacity-60">AI</span>
      </button>
    </nav>
  );
}
