"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar }          from "./Sidebar";
import { ThoughtsPanel }    from "./ThoughtsPanel";
import { MainContentInner } from "./MainContentInner";
import { BottomNav }        from "./BottomNav";
import { InstallPrompt }    from "@/components/ui/install-prompt";
import { useAppStore }      from "@/store/useAppStore";

const PUBLIC_PATHS = ["/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router   = useRouter();
  const { updateProfile } = useAppStore();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (session?.user?.name) updateProfile({ name: session.user.name });
    if (session?.user?.email) updateProfile({ email: session.user.email });
  }, [session, updateProfile]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session && !isPublic) {
      router.replace(`/auth?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [session, status, isPublic, pathname, router]);

  if (status === "loading" && !isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isPublic) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <MainContentInner>
        {children}
      </MainContentInner>

      <ThoughtsPanel />
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
