"use client";

import { motion } from "motion/react";
import { useId } from "react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Interrupteur façon iOS, avec son libellé cliquable. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-[13px] text-text-secondary">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-200 disabled:opacity-50",
          checked ? "justify-end bg-accent-strong" : "justify-start bg-border-strong",
        )}
      >
        <motion.span layout transition={spring.snappy} className="size-5 rounded-full bg-white shadow-card" />
      </button>
    </div>
  );
}
