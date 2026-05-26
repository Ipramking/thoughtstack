"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import {
  Home, CheckSquare, BookOpen, Calendar, User,
  Settings, Brain, ChevronLeft, ChevronRight,
  Sun, Moon, LogOut, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";

const NAV = {
  Core: [
    { href: "/",         icon: Home,        label: "Home"     },
    { href: "/tasks",    icon: CheckSquare, label: "Tasks"    },
    { href: "/journal",  icon: BookOpen,    label: "Journal"  },
    { href: "/calendar", icon: Calendar,    label: "Calendar" },
  ],
  Account: [
    { href: "/profile",  icon: User,        label: "Profile"  },
    { href: "/settings", icon: Settings,    label: "Settings" },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { sidebarCollapsed, toggleSidebar, toggleThoughtsPanel, profile } = useAppStore();

  async function handleLogout() {
    useAppStore.getState().updateProfile({ name: "User" });
    localStorage.removeItem("thoughtstack-storage");
    await signOut({ callbackUrl: "/auth" });
  }

  const NavItem = ({ href, icon: Icon, label, activeClassName }: {
    href: string; icon: typeof Home; label: string; activeClassName?: string;
  }) => {
    const active = pathname === href;
    return (
      <li>
        <Link
          href={href}
          className={cn(
            "flex items-center gap-2.5 mx-2 px-2.5 py-2 rounded-xl text-sm transition-all duration-150",
            sidebarCollapsed && "justify-center",
            active
              ? activeClassName ?? "bg-sidebar-accent text-sidebar-primary font-medium"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
          title={sidebarCollapsed ? label : undefined}
        >
          <Icon className={cn("w-4 h-4 shrink-0", active && "stroke-[2.2]")} />
          {!sidebarCollapsed && <span>{label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
      sidebarCollapsed ? "w-[60px]" : "w-[220px]"
    )}>

      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
        sidebarCollapsed && "justify-center px-3"
      )}>
        <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center shrink-0 shadow-sm">
          <Brain className="w-4 h-4 text-background" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground leading-none block">
              ThoughtStack
            </span>
            <span className="text-[10px] text-muted-foreground">Personal OS</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide space-y-5">
        {Object.entries(NAV).map(([section, items]) => (
          <div key={section}>
            {!sidebarCollapsed && (
              <p className="px-4 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {section}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => <NavItem key={item.href} {...item} />)}
            </ul>
          </div>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <div>
            {!sidebarCollapsed && (
              <p className="px-4 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-blue-400/70">
                Admin
              </p>
            )}
            <ul className="space-y-0.5">
              <NavItem
                href="/admin"
                icon={Shield}
                label="Admin Panel"
                activeClassName="bg-blue-500/15 text-blue-400 font-medium"
              />
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className={cn(
        "border-t border-sidebar-border p-2.5 space-y-1",
        sidebarCollapsed && "flex flex-col items-center"
      )}>
        {/* User pill */}
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ring-2 ring-border">
              {profile.avatar
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                : profile.name.charAt(0).toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate leading-none">{profile.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{session?.user?.email ?? ""}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <Button
          variant="ghost" size={sidebarCollapsed ? "icon" : "sm"}
          className={cn("w-full justify-start gap-2.5 text-sidebar-foreground hover:bg-sidebar-accent/60 rounded-xl text-sm", sidebarCollapsed && "w-9 justify-center")}
          onClick={toggleThoughtsPanel}
        >
          <Brain className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && "Thoughts AI"}
        </Button>

        <Button
          variant="ghost" size={sidebarCollapsed ? "icon" : "sm"}
          className={cn("w-full justify-start gap-2.5 text-sidebar-foreground hover:bg-sidebar-accent/60 rounded-xl text-sm", sidebarCollapsed && "w-9 justify-center")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          {!sidebarCollapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
        </Button>

        <Button
          variant="ghost" size={sidebarCollapsed ? "icon" : "sm"}
          className={cn("w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl text-sm", sidebarCollapsed && "w-9 justify-center")}
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && "Sign out"}
        </Button>

        {/* Collapse toggle */}
        <Button
          variant="ghost" size="icon"
          className="w-8 h-8 self-end text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 rounded-xl ml-auto block"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  );
}
