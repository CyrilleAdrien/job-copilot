"use client";

import { motion } from "motion/react";
import { useId } from "react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type Segment<T extends string> = { value: T; label: string };

/** Sélecteur à segments : l'option choisie est noire et la pastille glisse vers elle. */
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
      className="inline-flex w-fit rounded-[14px] border border-border p-0.5"
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
              "relative h-9 whitespace-nowrap rounded-[12px] px-3.5 text-sm transition-colors duration-150",
              selected ? "font-medium text-background" : "text-text-secondary hover:bg-surface-hover hover:text-text",
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[12px] bg-text"
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
