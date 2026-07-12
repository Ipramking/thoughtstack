import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon:           LucideIcon;
  title:          string;
  description?:   string;
  action?:        React.ReactNode;
  secondaryHint?: string;
  className?:     string;
  iconClassName?: string;
}

/**
 * Polished empty state. Includes:
 *   - Iconized badge with subtle gradient ring
 *   - Bold title, supporting description
 *   - Primary call-to-action
 *   - Optional secondary hint underneath (e.g. keyboard shortcut)
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryHint,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-14 px-6 animate-fade-in",
        className,
      )}
    >
      <div
        className={cn(
          // Subtle gradient ring + soft bg for the icon, matches dark theme
          "relative w-20 h-20 rounded-3xl flex items-center justify-center mb-5",
          "bg-gradient-to-br from-muted/80 to-muted/40",
          "ring-1 ring-border/60",
          iconClassName,
        )}
      >
        {/* Soft inner glow */}
        <div className="absolute inset-1 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
        <Icon className="w-8 h-8 text-muted-foreground relative z-10" strokeWidth={1.5} />
      </div>

      <p className="text-base font-semibold mb-1.5 tracking-tight">{title}</p>

      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-1">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}

      {secondaryHint && (
        <p className="text-[11px] text-muted-foreground/70 mt-3">{secondaryHint}</p>
      )}
    </div>
  );
}
