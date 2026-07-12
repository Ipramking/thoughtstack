import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  icon?: React.ReactNode;    // optional leading icon (already sized/coloured)
  action?: React.ReactNode;  // optional trailing link/button
  className?: string;
}

/** Consistent section group label: tiny uppercase heading with optional icon and trailing action. */
export function SectionLabel({ children, icon, action, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center justify-between px-1", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}
        {children}
      </p>
      {action}
    </div>
  );
}
