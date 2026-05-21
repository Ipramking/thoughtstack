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
  { href: "/calendar", icon: Calendar,    label: "Cal"     },
];

export function BottomNav() {
  const pathname              = usePathname();
  const { toggleThoughtsPanel } = useAppStore();

  if (pathname === "/auth") return null;

  return (
    <nav
      className={cn(
        /* Fixed to bottom, full width, only on mobile */
        "fixed bottom-0 left-0 right-0 z-40 md:hidden",
        /* Glass background + safe area */
        "bg-background/95 backdrop-blur-xl border-t border-border",
        /* Height = 64px + safe-area-inset-bottom */
        "h-nav pb-safe",
        /* Flex children */
        "flex items-start"
      )}
    >
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 pt-2",
              "min-h-[64px] transition-colors duration-150",
              active ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <div className={cn(
              "w-10 h-7 flex items-center justify-center rounded-xl transition-all duration-200",
              active && "bg-primary/10"
            )}>
              <Icon className={cn("w-[22px] h-[22px] transition-all", active && "stroke-[2.3]")} />
            </div>
            <span className={cn("text-[10px] font-medium leading-none", active ? "opacity-100" : "opacity-50")}>
              {label}
            </span>
          </Link>
        );
      })}

      {/* Thoughts AI */}
      <button
        onClick={toggleThoughtsPanel}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 min-h-[64px] text-muted-foreground transition-colors duration-150"
      >
        <div className="w-10 h-7 flex items-center justify-center rounded-xl">
          <Brain className="w-[22px] h-[22px]" />
        </div>
        <span className="text-[10px] font-medium leading-none opacity-50">AI</span>
      </button>
    </nav>
  );
}
