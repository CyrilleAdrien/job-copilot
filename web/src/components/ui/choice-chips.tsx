"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Choix multiples sous forme de pastilles, avec une coche qui apparaît sur la sélection. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1.5 text-[13px] font-medium text-text">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(selected ? value.filter((v) => v !== option.value) : [...value, option.value])
              }
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors duration-150",
                selected
                  ? "border-text bg-text text-background"
                  : "border-border bg-background-subtle text-text hover:border-border-strong",
              )}
            >
              <AnimatePresence initial={false}>
                {selected && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={spring.snappy}
                    className="overflow-hidden"
                  >
                    <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                  </motion.span>
                )}
              </AnimatePresence>
              {option.label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}
