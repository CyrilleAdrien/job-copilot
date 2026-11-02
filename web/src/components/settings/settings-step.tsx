"use client";

import { AlertCircle, Check, ChevronDown, Circle, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { spring } from "@/lib/motion";
import type { Step, StepState } from "@/lib/system";
import { cn } from "@/lib/utils";

const STATES: Record<StepState, { label: string; className: string }> = {
  ready: { label: "Prêt", className: "bg-success-soft text-success" },
  todo: { label: "À faire", className: "bg-accent-soft text-accent-strong" },
  error: { label: "À corriger", className: "bg-danger-soft text-danger" },
  locked: { label: "Verrouillé", className: "bg-background-subtle text-text-tertiary" },
  optional: { label: "Facultatif", className: "bg-background-subtle text-text-secondary" },
};

const ICONS: Record<StepState, ReactNode> = {
  ready: <Check className="size-4" aria-hidden />,
  todo: <Circle className="size-3" aria-hidden />,
  error: <AlertCircle className="size-4" aria-hidden />,
  locked: <Lock className="size-3.5" aria-hidden />,
  optional: <Circle className="size-3" aria-hidden />,
};

/** Une étape des réglages : son numéro, son état en un coup d'œil, et son contenu une fois ouverte. */
export function SettingsStep({
  step,
  number,
  open,
  onToggle,
  children,
}: {
  step: Step;
  number: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { label, className } = STATES[step.state];
  const locked = step.state === "locked";

  return (
    <Card id={step.id} className="scroll-mt-6 overflow-hidden">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          disabled={locked}
          onClick={onToggle}
          className={cn("flex w-full items-center gap-3.5 p-4 text-left transition-colors duration-150", locked ? "cursor-not-allowed" : "hover:bg-background-subtle")}
        >
          <span aria-hidden className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-medium tabular-nums", className)}>
            {ICONS[step.state]}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn("text-sm font-medium", locked && "text-text-tertiary")}>
              {number}. {step.title}
            </span>
            <span className="truncate text-[13px] text-text-secondary">{step.summary}</span>
          </span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium", className)}>{label}</span>
          {!locked && <ChevronDown className={cn("size-4 shrink-0 text-text-tertiary transition-transform duration-150", open && "rotate-180")} aria-hidden />}
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {open && !locked && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring.smooth} className="overflow-hidden">
            <div className="border-t border-border p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
