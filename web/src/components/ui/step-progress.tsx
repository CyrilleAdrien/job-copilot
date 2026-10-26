"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type Step = { id: string; label: string };

/**
 * Progression par étapes réelles d'une tâche longue (génération de CV, collecte d'offres).
 * `current` est l'index de l'étape en cours ; `current === steps.length` signifie terminé.
 */
export function StepProgress({
  steps,
  current,
  tone = "ai",
}: {
  steps: Step[];
  current: number;
  tone?: "ai" | "accent";
}) {
  const color = tone === "ai" ? "bg-ai" : "bg-accent";
  const progress = Math.min(current, steps.length) / steps.length;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="h-1 overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={Math.min(current, steps.length)}
      >
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={spring.gentle}
        />
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "active" : "pending";
          return (
            <li key={step.id} className="flex items-center gap-3 text-sm" data-state={state}>
              <span className="relative flex size-5 items-center justify-center">
                <AnimatePresence mode="popLayout" initial={false}>
                  {state === "done" ? (
                    <motion.span
                      key="done"
                      className={cn("flex size-5 items-center justify-center rounded-full", color)}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={spring.snappy}
                    >
                      <Check className="size-3 text-white" strokeWidth={3} aria-hidden />
                    </motion.span>
                  ) : state === "active" ? (
                    <motion.span key="active" className="relative flex size-5 items-center justify-center">
                      <span
                        className={cn("absolute size-5 animate-ping rounded-full opacity-30", color)}
                      />
                      <span className={cn("size-2.5 rounded-full", color)} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="pending"
                      className="size-2.5 rounded-full border-[1.5px] border-border-strong"
                    />
                  )}
                </AnimatePresence>
              </span>
              <span
                className={cn(
                  "transition-colors duration-200",
                  state === "pending" ? "text-text-tertiary" : "text-text",
                  state === "active" && "font-medium",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
