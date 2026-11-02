"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { activeMailFilters, categories as categoryLabels, emptyMailFilters, type Category, type MailAccount, type MailFilters } from "@/lib/mail";
import { spring } from "@/lib/motion";
import { applicationStatuses, type ApplicationStatus } from "@/lib/statuses";

const PERIODS: { value: MailFilters["period"]; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "7", label: "7 j" },
  { value: "30", label: "30 j" },
  { value: "90", label: "90 j" },
];

/** Recherche et période toujours visibles ; le reste s'ouvre avec le bouton Filtres. */
export function MailFilterBar({
  sentFolder,
  filters,
  categories: present,
  statuses,
  accounts,
  shown,
  onChange,
}: {
  sentFolder: boolean;
  filters: MailFilters;
  /** Statuts de réponse présents dans le dossier. */
  categories: Category[];
  /** Statuts des candidatures liées aux mails du dossier. */
  statuses: ApplicationStatus[];
  accounts: MailAccount[];
  shown: number;
  onChange: (filters: MailFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (changes: Partial<MailFilters>) => onChange({ ...filters, ...changes });
  const active = activeMailFilters(filters, sentFolder);
  const extra = active - (filters.text.trim() ? 1 : 0) - (filters.period !== "all" ? 1 : 0);

  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <label className="flex h-10 min-w-48 flex-1 items-center gap-2.5 rounded-full border border-border px-4 transition-colors duration-150 focus-within:border-text hover:border-border-strong">
          <Search className="size-4 shrink-0 text-text-tertiary" aria-hidden />
          <span className="sr-only">Chercher dans les mails</span>
          <input
            type="search"
            value={filters.text}
            onChange={(event) => set({ text: event.target.value })}
            placeholder={sentFolder ? "Destinataire, objet, texte" : "Expéditeur, objet, texte"}
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-text-tertiary focus:outline-none"
          />
        </label>
        <SegmentedControl label="Période" segments={PERIODS} value={filters.period} onChange={(period) => set({ period })} />
        <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <SlidersHorizontal aria-hidden />
          Filtres
          {extra > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-text text-[11px] text-background">{extra}</span>}
        </Button>
        <span role="status" className="ml-auto whitespace-nowrap text-[13px] text-text-tertiary">
          {shown} mail{shown > 1 ? "s" : ""}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring.smooth} className="overflow-hidden">
            <div className="flex flex-col gap-4 border-t border-border bg-background-subtle p-4">
              {sentFolder ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Distribution</span>
                  <SegmentedControl
                    label="Distribution"
                    segments={[
                      { value: "all", label: "Tous" },
                      { value: "sent", label: "Acceptés" },
                      { value: "bounced", label: "Non distribués" },
                      { value: "uncertain", label: "Incertains" },
                    ]}
                    value={filters.delivery}
                    onChange={(delivery) => set({ delivery })}
                  />
                </div>
              ) : (
                <>
                  {present.length > 0 && (
                    <ChoiceChips
                      label="Statut de la réponse"
                      options={present.map((item) => ({ value: item, label: categoryLabels[item].label }))}
                      value={filters.categories}
                      onChange={(value) => set({ categories: value })}
                    />
                  )}
                  {statuses.length > 0 && (
                    <ChoiceChips
                      label="Statut de la candidature"
                      options={statuses.map((status) => ({ value: status, label: applicationStatuses[status].label }))}
                      value={filters.statuses}
                      onChange={(value) => set({ statuses: value })}
                    />
                  )}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium">Rattachement</span>
                    <SegmentedControl
                      label="Rattachement"
                      segments={[
                        { value: "all", label: "Tous" },
                        { value: "linked", label: "À une candidature" },
                        { value: "unlinked", label: "Sans candidature" },
                      ]}
                      value={filters.linked}
                      onChange={(linked) => set({ linked })}
                    />
                  </div>
                </>
              )}
              {accounts.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Boîte</span>
                  <SegmentedControl
                    label="Boîte"
                    segments={[{ value: "all", label: "Toutes" }, ...accounts.map((account) => ({ value: account.id, label: account.email }))]}
                    value={filters.account}
                    onChange={(account) => set({ account })}
                  />
                </div>
              )}
              {active > 0 && (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange(emptyMailFilters)}>
                  <RotateCcw aria-hidden />
                  Réinitialiser
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
