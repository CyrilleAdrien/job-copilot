import type { HTMLAttributes } from "react";

import { applicationStatuses, type ApplicationStatus, type Tone } from "@/lib/statuses";
import { cn } from "@/lib/utils";

/** Couleur de texte ou d'icône de chaque tonalité. */
export const toneText: Record<Tone, string> = {
  neutral: "text-text-tertiary",
  accent: "text-accent-strong",
  ai: "text-ai-strong",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/** Couleur pleine, pour un liseré ou une pastille. */
export const toneBar: Record<Tone, string> = {
  neutral: "bg-border-strong",
  accent: "bg-accent-strong",
  ai: "bg-ai",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export const tones: Record<Tone, string> = {
  neutral: "bg-surface-hover text-text-secondary",
  accent: "bg-accent-soft text-accent-strong",
  ai: "bg-ai-soft text-ai-strong",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium [&_svg]:size-3.5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, tone, icon: Icon } = applicationStatuses[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden strokeWidth={2} />
      {label}
    </Badge>
  );
}
