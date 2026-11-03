"use client";

import { cn } from "@/lib/utils";
import type { SearchProfile } from "@/lib/profile";

/**
 * Choisit la recherche dont on regarde ou modifie le CV, parmi les recherches actives.
 * `value` et `onChange` restent des positions dans la liste complète. Masqué sans vrai choix.
 */
export function SearchPicker({
  label,
  searches,
  value,
  onChange,
}: {
  label: string;
  searches: Pick<SearchProfile, "name" | "archived">[];
  value: number;
  onChange: (index: number) => void;
}) {
  const active = searches.map((search, index) => ({ search, index })).filter(({ search }) => !search.archived);
  if (active.length < 2) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      {active.map(({ search, index }) => (
        <button
          key={index}
          type="button"
          aria-pressed={index === value}
          onClick={() => onChange(index)}
          className={cn(
            "inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium transition-colors",
            index === value
              ? "border-transparent bg-text text-background"
              : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text",
          )}
        >
          {search.name || `Recherche ${index + 1}`}
        </button>
      ))}
    </div>
  );
}
