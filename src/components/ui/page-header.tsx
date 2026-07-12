"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: (() => void) | boolean;  // true = router.back()
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, onBack, action, className }: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else if (onBack === true) router.back();
  };

  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            onClick={handleBack}
            className="touch-target shrink-0 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex items-center gap-2 shrink-0">{action}</div>
      )}
    </div>
  );
}
