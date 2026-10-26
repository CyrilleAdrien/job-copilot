import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
      {action}
    </div>
  );
}
