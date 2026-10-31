"use client";

import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { tones, toneBar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  activeFilterCount,
  emptyFilters,
  isFiltering,
  statusOrder,
  type ApplicationSummary,
  type Filters,
  type Period,
} from "@/lib/applications";
import { spring } from "@/lib/motion";
import { applicationStatuses } from "@/lib/statuses";
import { cn } from "@/lib/utils";

const periods: { value: Period; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "7", label: "7 j" },
  { value: "30", label: "30 j" },
  { value: "90", label: "90 j" },
];

/**
 * Barre compacte de l'écran Candidatures : un champ de recherche et un bouton « Filtres »
 * qui ouvre statuts, période, recherche d'origine et documents dans un panneau.
 */
export function FilterBar({
  items,
  filters,
  searchNames,
  onChange,
}: {
  items: ApplicationSummary[];
  filters: Filters;
  /** Noms des profils de recherche, par identifiant. */
  searchNames: Record<string, string>;
  onChange: (filters: Filters) => void;
}) {
  const set = (changes: Partial<Filters>) => onChange({ ...filters, ...changes });
  const counts = Object.fromEntries(
    statusOrder.map((status) => [status, items.filter((i) => i.status === status).length]),
  );
  const searchIds = [...new Set(items.map((item) => item.search_id).filter((id): id is string => Boolean(id)))];
  const hasManual = items.some((item) => item.source === "manuel");
  const origins = [
    { value: "all", label: "Toutes" },
    ...searchIds.map((id) => ({ value: id, label: searchNames[id] ?? id })),
    ...(hasManual ? [{ value: "manual", label: "Ajoutées à la main" }] : []),
  ];
  const active = activeFilterCount(filters);

  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <label className="relative flex h-9 min-w-48 flex-1 items-center sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 size-4 text-text-tertiary" aria-hidden />
        <input
          type="search"
          value={filters.query}
          onChange={(event) => set({ query: event.target.value })}
          placeholder="Poste, entreprise, ville"
          aria-label="Rechercher une candidature"
          className="h-9 w-full rounded-full border border-border bg-surface pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-text-tertiary focus:border-accent-strong/60 [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query && (
          <button
            type="button"
            onClick={() => set({ query: "" })}
            aria-label="Effacer la recherche"
            className="absolute right-2 flex size-5 items-center justify-center rounded-full text-text-tertiary hover:text-text"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </label>

      <Popover
        label="Filtres"
        highlighted={active > 0}
        trigger={
          <>
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtres
            {active > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-strong px-1.5 text-[11px] font-semibold tabular-nums text-white">
                {active}
              </span>
            )}
          </>
        }
      >
        <Section title="Statut">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Statuts">
            {statusOrder.map((status) => {
              const { label, tone } = applicationStatuses[status];
              const selected = filters.statuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    set({
                      statuses: selected ? filters.statuses.filter((s) => s !== status) : [...filters.statuses, status],
                    })
                  }
                  className={cn(
                    "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors",
                    selected
                      ? cn("border-transparent", tones[tone])
                      : "border-border bg-surface text-text-secondary hover:text-text",
                  )}
                >
                  <span className={cn("size-2 rounded-full", toneBar[tone])} aria-hidden />
                  {label}
                  <span className="tabular-nums opacity-70">{counts[status]}</span>
                </button>
              );
            })}
          </div>
        </Section>
        <Section title="Période">
          <SegmentedControl label="Période" segments={periods} value={filters.period} onChange={(period) => set({ period })} />
        </Section>
        {origins.length > 2 && (
          <Section title="Recherche d'origine">
            <SegmentedControl
              label="Recherche d'origine"
              segments={origins}
              value={filters.search}
              onChange={(search) => set({ search })}
            />
          </Section>
        )}
        <Switch
          checked={filters.missingDocuments}
          onChange={(missingDocuments) => set({ missingDocuments })}
          label="Documents manquants"
          description="Seulement les candidatures sans CV ou sans lettre."
        />
      </Popover>

      <AnimatePresence>
        {isFiltering(filters) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button variant="ghost" size="sm" onClick={() => onChange(emptyFilters)}>
              <RotateCcw aria-hidden />
              Réinitialiser
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-medium text-text-tertiary">{title}</p>
      {children}
    </div>
  );
}

/** Panneau ancré au bouton : se ferme au clic dehors ou avec Échap. */
function Popover({
  label,
  trigger,
  highlighted,
  children,
}: {
  label: string;
  trigger: ReactNode;
  highlighted: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
          highlighted || open
            ? "border-accent-strong/40 bg-accent-soft text-accent-strong"
            : "border-border bg-surface text-text-secondary hover:text-text",
        )}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={spring.snappy}
            className="absolute left-0 top-full z-30 mt-2 flex w-[min(28rem,calc(100vw-2rem))] origin-top-left flex-col gap-5 rounded-[14px] border border-border bg-surface p-5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.3)]"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
