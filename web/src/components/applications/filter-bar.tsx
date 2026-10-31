"use client";

import { FileWarning, RotateCcw, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { tones, toneBar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  emptyFilters,
  isFiltering,
  statusOrder,
  type ApplicationSummary,
  type Filters,
  type Period,
} from "@/lib/applications";
import { applicationStatuses } from "@/lib/statuses";
import { cn } from "@/lib/utils";

const periods: { value: Period; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "7", label: "7 j" },
  { value: "30", label: "30 j" },
  { value: "90", label: "90 j" },
];

/** Filtres de l'écran Candidatures : texte, statuts (avec leur nombre), recherche d'origine, période, documents. */
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
  const set = (changes: Partial<Filters>) =>
    onChange({ ...filters, ...changes });
  const counts = Object.fromEntries(
    statusOrder.map((status) => [
      status,
      items.filter((i) => i.status === status).length,
    ]),
  );
  const searchIds = [
    ...new Set(
      items
        .map((item) => item.search_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const hasManual = items.some((item) => item.source === "manuel");
  const origins = [
    { value: "all", label: "Toutes" },
    ...searchIds.map((id) => ({ value: id, label: searchNames[id] ?? id })),
    ...(hasManual ? [{ value: "manual", label: "Ajoutées à la main" }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-9 min-w-56 flex-1 items-center sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-text-tertiary"
            aria-hidden
          />
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
        <SegmentedControl
          label="Période"
          segments={periods}
          value={filters.period}
          onChange={(period) => set({ period })}
        />
        {origins.length > 2 && (
          <SegmentedControl
            label="Recherche d'origine"
            segments={origins}
            value={filters.search}
            onChange={(search) => set({ search })}
          />
        )}
        <button
          type="button"
          aria-pressed={filters.missingDocuments}
          onClick={() => set({ missingDocuments: !filters.missingDocuments })}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
            filters.missingDocuments
              ? "border-accent-strong/40 bg-accent-soft text-accent-strong"
              : "border-border bg-surface text-text-secondary hover:text-text",
          )}
        >
          <FileWarning className="size-4" aria-hidden />
          Documents manquants
        </button>
      </div>

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
                  statuses: selected
                    ? filters.statuses.filter((s) => s !== status)
                    : [...filters.statuses, status],
                })
              }
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors",
                selected
                  ? cn("border-transparent", tones[tone])
                  : "border-border bg-surface text-text-secondary hover:text-text",
              )}
            >
              <span
                className={cn("size-2 rounded-full", toneBar[tone])}
                aria-hidden
              />
              {label}
              <span className="tabular-nums opacity-70">{counts[status]}</span>
            </button>
          );
        })}
        <AnimatePresence>
          {isFiltering(filters) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ml-auto"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(emptyFilters)}
              >
                <RotateCcw aria-hidden />
                Réinitialiser
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
