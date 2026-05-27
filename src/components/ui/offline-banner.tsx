"use client";

import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineBannerProps {
  fullscreen?: boolean;
  name?: string;
}

export function OfflineBanner({ fullscreen, name }: OfflineBannerProps) {
  if (fullscreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80dvh] px-6 text-center page-enter">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
          <WifiOff className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">You&apos;re offline</h2>
        <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
          {name ? `Hey ${name.split(" ")[0]} — ` : ""}Your tasks and journal are saved on this device.
          Reconnect to sync and access all features.
        </p>
        <p className="text-xs text-muted-foreground mt-6 opacity-60">
          AI features and sync require an internet connection
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2.5 px-4 py-2.5 bg-yellow-500/10 border-b border-yellow-500/20",
      "text-yellow-600 dark:text-yellow-400",
    )}>
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <p className="text-xs font-medium">
        You&apos;re offline — your data is available, but AI and sync are paused.
      </p>
    </div>
  );
}
