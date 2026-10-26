"use client";

import { motion } from "motion/react";
import { useId } from "react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type Segment<T extends string> = { value: T; label: string };

/** Sélecteur à segments façon iOS : la pastille glisse vers l'option choisie. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-fit rounded-full border border-border bg-background-subtle p-0.5"
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(segment.value)}
            className={cn(
              "relative h-7 rounded-full px-3 text-[13px] font-medium transition-colors duration-150",
              selected ? "text-text" : "text-text-secondary hover:text-text",
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full border border-border bg-surface shadow-card"
                transition={spring.snappy}
              />
            )}
            <span className="relative">{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}
