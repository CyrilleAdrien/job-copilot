"use client";

import { motion } from "motion/react";
import { useRef, type WheelEvent } from "react";

import { dayStrip, swipedDay } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const DRAG_THRESHOLD = 40;
const WHEEL_THRESHOLD = 80;

/** Bandeau de jours : on glisse à la souris, au doigt ou au pavé tactile, ou on touche un jour. */
export function DayStrip({ anchor, now, onChange }: { anchor: Date; now: Date; onChange: (day: Date) => void }) {
  const wheel = useRef(0);

  function onWheel(event: WheelEvent) {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    wheel.current += event.deltaX;
    if (Math.abs(wheel.current) < WHEEL_THRESHOLD) return;
    // Pousser vers la droite sur le pavé donne un delta positif : le lendemain.
    const next = swipedDay(anchor, -wheel.current, WHEEL_THRESHOLD, now);
    wheel.current = 0;
    if (next) onChange(next);
  }

  return (
    <div onWheel={onWheel} className="min-w-0 flex-1 touch-pan-y overflow-hidden overscroll-x-contain">
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          const next = swipedDay(anchor, info.offset.x, DRAG_THRESHOLD, now);
          if (next) onChange(next);
        }}
        className="flex w-fit cursor-grab select-none items-center gap-1 active:cursor-grabbing"
        role="group"
        aria-label="Choisir un jour"
      >
        {dayStrip(anchor, now).map(({ day, label, full, selected, today, future }) => (
          <button
            key={day.toISOString()}
            type="button"
            aria-label={`Aller au ${full}`}
            aria-current={selected ? "date" : undefined}
            disabled={future}
            onClick={() => onChange(day)}
            className={cn(
              "relative h-9 whitespace-nowrap rounded-[12px] px-3 text-[13px] transition-colors duration-150",
              selected ? "bg-text font-medium text-background" : "text-text-secondary hover:bg-surface-hover hover:text-text",
              future && "pointer-events-none opacity-35",
            )}
          >
            {label}
            {today && <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
