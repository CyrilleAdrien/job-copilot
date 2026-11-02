"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Espace entre deux segments : ils restent distincts sans dépendre de la couleur. */
const GAP = 3;

export type DonutSegment = { id: string; label: string; value: number; color: string; dimmed?: boolean };

/** Anneau en segments, avec sa légende chiffrée : le survol d'un segment ou d'une ligne met l'autre en évidence. */
export function Donut({ segments, center, centerLabel, ariaLabel }: { segments: DonutSegment[]; center: ReactNode; centerLabel: string; ariaLabel: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  const hovered = segments.find((segment) => segment.id === active);
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 140 140" role="img" aria-label={ariaLabel} className="size-full -rotate-90">
          <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="var(--surface-hover)" strokeWidth="14" />
          {visible.map((segment) => {
            const length = (segment.value / total) * CIRCUMFERENCE;
            const dash = visible.length > 1 ? Math.max(length - GAP, 1) : length;
            const start = offset;
            offset += length;
            return (
              <circle
                key={segment.id}
                cx="70"
                cy="70"
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={active === segment.id ? 18 : 14}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-start}
                opacity={(active && active !== segment.id) || segment.dimmed ? 0.3 : 1}
                className="transition-[stroke-width,opacity] duration-150"
                onPointerEnter={() => setActive(segment.id)}
                onPointerLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[26px] font-normal leading-none tabular-nums">{hovered ? hovered.value : center}</span>
          <span className="max-w-20 pt-1 text-[11px] leading-tight text-text-secondary">{hovered ? hovered.label : centerLabel}</span>
        </div>
      </div>
      <ul className="flex min-w-40 flex-1 flex-col gap-1">
        {segments.map((segment) => (
          <li
            key={segment.id}
            onPointerEnter={() => setActive(segment.id)}
            onPointerLeave={() => setActive(null)}
            className={cn("flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] transition-colors duration-150", active === segment.id && "bg-surface-hover", segment.dimmed && "opacity-50")}
          >
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="tabular-nums text-text-secondary">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
