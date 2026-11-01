"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { toneBar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dayKey, eventKinds, formatTime, monthGrid, type CalendarEvent } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
/** Événements montrés dans une case ; les autres derrière « + N ». */
const PER_DAY = 3;

/** Vue mensuelle : un clic sur un jour vide crée un événement, un clic sur un événement l'ouvre. */
export function MonthView({
  month,
  days,
  today,
  onMonth,
  onDay,
  onEvent,
}: {
  month: Date;
  days: Map<string, CalendarEvent[]>;
  today: Date;
  onMonth: (month: Date) => void;
  onDay: (day: string) => void;
  onEvent: (event: CalendarEvent) => void;
}) {
  const todayKey = dayKey(today);
  const shift = (delta: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  return (
    <section aria-label="Mois" className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <h2 className="text-[17px] font-semibold capitalize tracking-tight">{monthFormat.format(month)}</h2>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Aujourd&apos;hui
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Mois précédent" onClick={() => shift(-1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Mois suivant" onClick={() => shift(1)}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </header>
      <div className="grid grid-cols-7 overflow-hidden rounded-card border border-border bg-border [gap:1px]" role="grid">
        {WEEKDAYS.map((name) => (
          <div key={name} role="columnheader" className="bg-background-subtle px-2 py-1.5 text-[11px] font-medium uppercase text-text-tertiary">
            {name}
          </div>
        ))}
        {monthGrid(month).map((date) => {
          const key = dayKey(date);
          const items = days.get(key) ?? [];
          const outside = date.getMonth() !== month.getMonth();
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              role="gridcell"
              aria-label={`${date.getDate()} ${items.length ? `, ${items.length} événement${items.length > 1 ? "s" : ""}` : ""}`}
              className={cn("group flex min-h-28 flex-col gap-1 bg-surface p-1.5", outside && "bg-background-subtle/60")}
            >
              <button
                type="button"
                onClick={() => onDay(key)}
                aria-label={`Ajouter un événement le ${date.toLocaleDateString("fr-FR")}`}
                className="flex items-center justify-between rounded-[6px] px-1 text-left transition-colors hover:bg-surface-hover"
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums",
                    outside ? "text-text-tertiary" : "text-text-secondary",
                    isToday && "bg-accent-strong font-semibold text-white",
                  )}
                >
                  {date.getDate()}
                </span>
                <span className="text-[16px] leading-none text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                  +
                </span>
              </button>
              {items.slice(0, PER_DAY).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEvent(event)}
                  title={event.title}
                  className="flex items-center gap-1.5 truncate rounded-[6px] px-1.5 py-0.5 text-left text-[11px] transition-colors hover:bg-surface-hover"
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", toneBar[eventKinds[event.kind].tone])} aria-hidden />
                  <span className="tabular-nums text-text-tertiary">{formatTime(event.starts_at)}</span>
                  <span className="truncate font-medium">{event.title}</span>
                </button>
              ))}
              {items.length > PER_DAY && (
                <button
                  type="button"
                  onClick={() => onEvent(items[PER_DAY])}
                  className="px-1.5 text-left text-[11px] text-text-tertiary hover:text-text"
                >
                  + {items.length - PER_DAY}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
