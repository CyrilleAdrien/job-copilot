"use client";

import { AlertCircle, Check, ChevronRight, Circle, Lock } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { spring } from "@/lib/motion";
import type { Step, StepState } from "@/lib/system";
import { cn } from "@/lib/utils";

export const STEP_STATES: Record<StepState, { label: string; className: string }> = {
  ready: { label: "Prêt", className: "bg-success-soft text-success" },
  todo: { label: "À faire", className: "bg-warning-soft text-warning" },
  error: { label: "À corriger", className: "bg-danger-soft text-danger" },
  locked: { label: "Verrouillé", className: "bg-surface-hover text-text-tertiary" },
  optional: { label: "Facultatif", className: "bg-surface-hover text-text-secondary" },
};

const ICONS: Record<StepState, ReactNode> = {
  ready: <Check className="size-4" aria-hidden />,
  todo: <Circle className="size-3" aria-hidden />,
  error: <AlertCircle className="size-4" aria-hidden />,
  locked: <Lock className="size-3.5" aria-hidden />,
  optional: <Circle className="size-3" aria-hidden />,
};

/** Une étape dans la liste des réglages. Un trait la relie à la suivante : elles se font dans l'ordre. */
export function SettingsStepItem({
  step,
  number,
  selected,
  last,
  onSelect,
}: {
  step: Step;
  number: number;
  selected: boolean;
  last: boolean;
  onSelect: () => void;
}) {
  const { label, className } = STEP_STATES[step.state];
  const locked = step.state === "locked";

  return (
    <li className="relative">
      {!last && <span aria-hidden className="absolute bottom-[-10px] left-[25px] top-11 w-px bg-border" />}
      <button
        type="button"
        aria-current={selected ? "step" : undefined}
        disabled={locked}
        onClick={onSelect}
        className={cn(
          "group relative flex w-full items-start gap-3 rounded-[14px] p-3 text-left transition-colors duration-150",
          locked ? "cursor-not-allowed" : !selected && "hover:bg-surface-hover",
        )}
      >
        {selected && <motion.span layoutId="settings-step" className="absolute inset-0 rounded-[14px] bg-accent-soft" transition={spring.snappy} />}
        <span aria-hidden className={cn("relative flex size-7 shrink-0 items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-110", className)}>
          {ICONS[step.state]}
        </span>
        <span className="relative flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center justify-between gap-2">
            <span className={cn("text-sm font-medium", locked && "text-text-tertiary")}>
              {number}. {step.title}
            </span>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", className)}>{label}</span>
          </span>
          <span className="line-clamp-2 break-words text-[13px] text-text-secondary">{step.summary}</span>
        </span>
        {!locked && (
          <ChevronRight
            className={cn("relative mt-1.5 size-4 shrink-0 text-text-tertiary transition-transform duration-150 group-hover:translate-x-0.5", selected && "text-text")}
            aria-hidden
          />
        )}
      </button>
    </li>
  );
}
