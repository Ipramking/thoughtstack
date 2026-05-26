"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import {
  Home, CheckSquare, BookOpen, Calendar,
  User, Settings, Brain, ChevronLeft, ChevronRight,
  Sun, Moon, LogOut, Shield, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const NAV_CORE = [
  { href: "/",         icon: Home,        label: "Home"     },
  { href: "/tasks",    icon: CheckSquare, label: "Tasks"    },
  { href: "/journal",  icon: BookOpen,    label: "Journal"  },
  { href: "/calendar", icon: Calendar,    label: "Calendar" },
];

const NAV_ACCOUNT = [
  { href: "/profile",  icon: User,     label: "Profile"  },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname  = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useSession();
  const isAdmin   = session?.user?.role === "admin";
  const { sidebarCollapsed, toggleSidebar, toggleThoughtsPanel, profile } = useAppStore();

  async function handleLogout() {
    localStorage.removeItem("thoughtstack-storage");
    await signOut({ callbackUrl: "/auth" });
  }

  function NavItem({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        onClick={onClose}
        title={sidebarCollapsed ? label : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
          sidebarCollapsed && "justify-center px-2.5",
          active
            ? "bg-foreground/8 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className={cn("w-[18px] h-[18px] shrink-0 transition-all", active && "stroke-[2.2]")} />
        {!sidebarCollapsed && <span className="truncate">{label}</span>}
        {/* Active dot */}
        {active && !sidebarCollapsed && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          /* Layout */
          "fixed inset-y-0 left-0 z-50 flex flex-col",
          "bg-sidebar border-r border-sidebar-border",
          /* Width */
          "w-[270px]",
          sidebarCollapsed ? "md:w-[64px]" : "md:w-[240px]",
          /* Mobile slide transition */
          "transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* ── Logo row ── */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border shrink-0",
          sidebarCollapsed && "md:justify-center md:px-3",
        )}>
          <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center shrink-0 shadow-sm">
            <Brain className="w-4 h-4 text-background" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm tracking-tight text-sidebar-foreground leading-none">ThoughtStack</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Personal OS</p>
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide space-y-6">

          {/* Core */}
          <div className="space-y-0.5">
            {!sidebarCollapsed && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pb-2">
                Menu
              </p>
            )}
            {NAV_CORE.map((item) => <NavItem key={item.href} {...item} />)}
          </div>

          {/* Divider */}
          {!sidebarCollapsed && <div className="border-t border-sidebar-border mx-1" />}

          {/* Account */}
          <div className="space-y-0.5">
            {!sidebarCollapsed && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 pb-2">
                Account
              </p>
            )}
            {NAV_ACCOUNT.map((item) => <NavItem key={item.href} {...item} />)}
          </div>

          {/* Admin */}
          {isAdmin && (
            <>
              {!sidebarCollapsed && <div className="border-t border-sidebar-border mx-1" />}
              <div className="space-y-0.5">
                {!sidebarCollapsed && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 px-3 pb-2">
                    Admin
                  </p>
                )}
                <Link
                  href="/admin"
                  onClick={onClose}
                  title={sidebarCollapsed ? "Admin Panel" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    sidebarCollapsed && "justify-center px-2.5",
                    pathname === "/admin"
                      ? "bg-blue-500/15 text-blue-400"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Shield className="w-[18px] h-[18px] shrink-0" />
                  {!sidebarCollapsed && <span>Admin Panel</span>}
                </Link>
              </div>
            </>
          )}
        </nav>

        {/* ── Bottom section ── */}
        <div className={cn(
          "shrink-0 border-t border-sidebar-border p-3 space-y-1",
          sidebarCollapsed && "flex flex-col items-center",
        )}>
          {/* User info */}
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ring-2 ring-border">
                {profile.avatar
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                  : <span>{profile.name.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate leading-none">{profile.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{session?.user?.email ?? ""}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className={cn("flex gap-1", sidebarCollapsed && "flex-col items-center")}>
            <button
              onClick={toggleThoughtsPanel}
              title="Thoughts AI"
              className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Brain className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="text-xs font-medium">Thoughts AI</span>}
            </button>

            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title="Toggle theme"
              className="p-2 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex w-full items-center justify-center gap-1.5 py-1.5 mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
          >
            {sidebarCollapsed
              ? <><ChevronRight className="w-3.5 h-3.5" /> </>
              : <><ChevronLeft className="w-3.5 h-3.5" /> <span>Collapse</span></>
            }
          </button>
        </div>
      </aside>
    </>
  );
}
