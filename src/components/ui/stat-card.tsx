import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({
  label, value, sub, icon: Icon, iconColor = "text-muted-foreground", className,
}: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3 hover:border-border/60 transition-colors",
      className
    )}>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium mb-1 truncate">{label}</p>
        <p className="text-2xl font-bold tracking-tight leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5 truncate">{sub}</p>}
      </div>
      {Icon && (
        <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
          <Icon className={cn("w-4.5 h-4.5", iconColor)} strokeWidth={2} />
        </div>
      )}
    </div>
  );
}
