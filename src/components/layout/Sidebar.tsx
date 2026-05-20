"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import {
  Home, CheckSquare, BookOpen, Zap, Calendar, User,
  Settings, Download, Brain, ChevronLeft, ChevronRight,
  Sun, Moon, BarChart2, LogOut, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";

const NAV = {
  Core: [
    { href: "/", icon: Home, label: "Home" },
    { href: "/tasks", icon: CheckSquare, label: "Tasks" },
    { href: "/journal", icon: BookOpen, label: "Journal" },
    { href: "/skills", icon: Zap, label: "Skills" },
    { href: "/calendar", icon: Calendar, label: "Calendar" },
    { href: "/analytics", icon: BarChart2, label: "Analytics" },
  ],
  Personal: [
    { href: "/profile", icon: User, label: "Profile" },
  ],
  System: [
    { href: "/settings", icon: Settings, label: "Settings" },
    { href: "/export",   icon: Download, label: "Export"   },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { sidebarCollapsed, toggleSidebar, toggleThoughtsPanel, profile } = useAppStore();

  async function handleLogout() {
    // Clear local state and sign out via NextAuth
    useAppStore.getState().updateProfile({ name: "User" });
    localStorage.removeItem("thoughtstack-storage");
    await signOut({ callbackUrl: "/auth" });
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-300",
        sidebarCollapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-border",
        sidebarCollapsed && "justify-center px-2"
      )}>
        <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-background" />
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-sm tracking-tight text-sidebar-foreground">
            ThoughtStack
          </span>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        {Object.entries(NAV).map(([section, items]) => (
          <div key={section} className="mb-6">
            {!sidebarCollapsed && (
              <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map(({ href, icon: Icon, label }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm transition-colors",
                        sidebarCollapsed && "justify-center",
                        active
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      title={sidebarCollapsed ? label : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!sidebarCollapsed && <span>{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Admin section — only visible to admins */}
        {isAdmin && (
          <div className="mb-6">
            {!sidebarCollapsed && (
              <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Admin
              </p>
            )}
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm transition-colors",
                    sidebarCollapsed && "justify-center",
                    pathname === "/admin"
                      ? "bg-blue-500/20 text-blue-400 font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  title={sidebarCollapsed ? "Admin Panel" : undefined}
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Admin Panel</span>}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom actions */}
      <div className={cn(
        "border-t border-border p-3 flex flex-col gap-2",
        sidebarCollapsed && "items-center"
      )}>
        {/* User row */}
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
              {profile.avatar
                ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                : profile.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-sidebar-foreground truncate flex-1">
              {profile.name}
            </span>
          </div>
        )}

        {/* Thoughts AI button */}
        <Button
          variant="ghost"
          size={sidebarCollapsed ? "icon" : "sm"}
          className={cn("w-full text-sidebar-foreground hover:bg-sidebar-accent", sidebarCollapsed && "w-9")}
          onClick={toggleThoughtsPanel}
          title="Open Thoughts AI"
        >
          <Brain className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span className="ml-2">Thoughts AI</span>}
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size={sidebarCollapsed ? "icon" : "sm"}
          className={cn("w-full text-sidebar-foreground hover:bg-sidebar-accent", sidebarCollapsed && "w-9")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Toggle theme"
        >
          {theme === "dark"
            ? <Sun className="w-4 h-4 shrink-0" />
            : <Moon className="w-4 h-4 shrink-0" />}
          {!sidebarCollapsed && (
            <span className="ml-2">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          )}
        </Button>

        {/* Logout */}
        <Button
          variant="ghost"
          size={sidebarCollapsed ? "icon" : "sm"}
          className={cn("w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10", sidebarCollapsed && "w-9")}
          onClick={handleLogout}
          title="Sign out"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span className="ml-2">Sign out</span>}
        </Button>

        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 self-end text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  );
}
