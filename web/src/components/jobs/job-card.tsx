"use client";

import { Banknote, ChevronDown, ExternalLink, House, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { ScoreRing } from "@/components/jobs/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  contractLabels,
  fetchOffer,
  isFresh,
  sourceLabels,
  timeAgo,
  type Offer,
  type OfferDetail,
} from "@/lib/jobs";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const MAX_TECHS = 4;

export function JobCard({ offer, now }: { offer: Offer; now: Date }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OfferDetail | null>(null);
  const [failed, setFailed] = useState(false);

  function toggle() {
    setOpen((value) => !value);
    if (!detail) {
      fetchOffer(offer.id)
        .then(setDetail)
        .catch(() => setFailed(true));
    }
  }

  const extraTechs = offer.matched.length - MAX_TECHS;
  const fresh = isFresh(offer.published_at, now);

  return (
    <motion.article
      layout="position"
      transition={spring.smooth}
      className="overflow-hidden rounded-card border border-border bg-surface shadow-card transition-colors hover:border-border-strong"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background-subtle text-[15px] font-semibold text-text-secondary"
        >
          {(offer.company ?? offer.title).charAt(0).toUpperCase()}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{offer.title}</h3>
            {fresh && (
              <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[11px] font-medium leading-5 text-accent-strong">
                Nouveau
              </span>
            )}
          </div>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-text-secondary">
            <span className="truncate">{offer.company ?? "Entreprise non précisée"}</span>
            {offer.location && (
              <>
                <MapPin className="size-3.5 shrink-0 text-text-tertiary" aria-hidden />
                <span className="truncate">{offer.location}</span>
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {offer.contract && <Badge>{contractLabels[offer.contract]}</Badge>}
            {offer.remote && (
              <Badge>
                <House aria-hidden />
                {offer.remote === "remote" ? "Full remote" : "Télétravail partiel"}
              </Badge>
            )}
            {offer.salary && (
              <Badge>
                <Banknote aria-hidden />
                {offer.salary}
              </Badge>
            )}
            {offer.matched.slice(0, MAX_TECHS).map((tech) => (
              <Badge key={tech} tone="accent">
                {tech}
              </Badge>
            ))}
            {extraTechs > 0 && <Badge tone="accent">+{extraTechs}</Badge>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <time dateTime={offer.published_at} className="text-[13px] text-text-tertiary">
            {timeAgo(offer.published_at, now)}
          </time>
          <ScoreRing score={offer.score} />
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 text-text-tertiary transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
          >
            <div className="flex flex-col gap-4 border-t border-border px-5 py-4">
              {detail ? (
                <p className="max-h-80 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                  {detail.description || offer.snippet}
                </p>
              ) : failed ? (
                <p className="text-sm text-text-secondary">{offer.snippet}</p>
              ) : (
                <div className="flex flex-col gap-2" aria-busy>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-11/12" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-tertiary">
                  Source : {sourceLabels[offer.source] ?? offer.source}
                </span>
                <Button variant="secondary" size="sm" asChild>
                  <a href={offer.url} target="_blank" rel="noreferrer">
                    Voir l&apos;offre
                    <ExternalLink aria-hidden />
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
