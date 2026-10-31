"use client";

import { ArrowUpRight, Check, ChevronDown, CircleAlert, CircleDashed, Clock, Sparkles } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { draftReadiness, type ApplicationSummary } from "@/lib/applications";
import { timeAgo } from "@/lib/jobs";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Candidatures préparées mais pas encore envoyées : ce qu'il manque à chacune et l'action suivante.
 * Une fiche qui attend depuis plus de 3 jours est signalée : les offres partent vite.
 */
export function DraftsPanel({
  items,
  now,
  onOpen,
  onSent,
}: {
  items: ApplicationSummary[];
  now: Date;
  onOpen: (id: string) => void;
  onSent: (id: string) => void;
}) {
  const drafts = items
    .filter((item) => item.status === "draft")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const [open, setOpen] = useState(true);
  if (drafts.length === 0) return null;
  const late = drafts.filter((item) => draftReadiness(item, now).late).length;

  return (
    <section className="rounded-card border border-border bg-surface shadow-card" aria-label="Candidatures à finaliser">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <CircleDashed className="size-4 text-text-tertiary" aria-hidden />
        <span className="text-[15px] font-semibold">À finaliser</span>
        <span className="rounded-full bg-surface-hover px-2 text-[12px] font-medium leading-5 tabular-nums text-text-secondary">
          {drafts.length}
        </span>
        {late > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] text-warning">
            <Clock className="size-3.5" aria-hidden />
            {late} en attente depuis plus de 3 jours
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={cn("ml-auto size-4 text-text-tertiary transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            {drafts.map((item) => {
              const readiness = draftReadiness(item, now);
              return (
                <motion.li
                  key={item.id}
                  layout="position"
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-5 py-3"
                >
                  <button type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-sm font-medium hover:text-accent-strong">{item.title}</span>
                    <span className={cn("truncate text-[12px]", readiness.late ? "text-warning" : "text-text-tertiary")}>
                      {item.company ?? "Entreprise non précisée"} · préparée {timeAgo(item.created_at, now)}
                    </span>
                  </button>
                  <div className="flex items-center gap-3 text-[12px]">
                    <Step done={readiness.cv} label="CV" />
                    <Step done={readiness.letter} label="Lettre" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {readiness.missing && item.offer_id !== null ? (
                      <Button variant="ai" size="sm" asChild>
                        <Link href={`/offres/${item.offer_id}`}>
                          <Sparkles aria-hidden />
                          Générer
                        </Link>
                      </Button>
                    ) : (
                      item.url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={item.url} target="_blank" rel="noreferrer">
                            Ouvrir l&apos;offre
                            <ArrowUpRight aria-hidden />
                          </a>
                        </Button>
                      )
                    )}
                    <Button variant="secondary" size="sm" onClick={() => onSent(item.id)}>
                      <Check aria-hidden />
                      Envoyée
                    </Button>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", done ? "text-success" : "text-text-tertiary")}>
      {done ? <Check className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}
      {label}
    </span>
  );
}
