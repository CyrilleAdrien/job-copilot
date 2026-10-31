"use client";

import { Banknote, ChevronDown, ExternalLink, FilePlus2, House, MapPin, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { ScoreRing } from "@/components/jobs/score-ring";
import { Badge, StatusBadge } from "@/components/ui/badge";
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
import type { ApplicationStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";

const MAX_TECHS = 4;

export function JobCard({
  offer,
  now,
  search,
  onFavorite,
  application,
  onCreateApplication,
}: {
  offer: Offer;
  now: Date;
  search?: string;
  onFavorite?: (offer: Offer, favorite: boolean) => void;
  /** Statut de la candidature déjà créée pour cette offre. */
  application?: ApplicationStatus;
  /** Crée la candidature « À envoyer » sans quitter la liste (proposé sur les favoris). */
  onCreateApplication?: (offer: Offer) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OfferDetail | null>(null);
  const [failed, setFailed] = useState(false);

  function toggle() {
    setOpen((value) => !value);
    if (!detail) {
      fetchOffer(offer.id, search)
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
      <div className="flex w-full items-start gap-4 p-5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex min-w-0 flex-1 items-start gap-4 text-left"
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
            {fresh && !application && (
              <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[11px] font-medium leading-5 text-accent-strong">
                Nouveau
              </span>
            )}
            {application && <StatusBadge status={application} />}
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
      </button>

        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <time dateTime={offer.published_at} className="text-[13px] text-text-tertiary">
            {timeAgo(offer.published_at, now)}
          </time>
          <ScoreRing score={offer.score} />
          <div className="flex items-center gap-1">
            {onFavorite && (
              <button
                type="button"
                aria-pressed={offer.favorite}
                aria-label={offer.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                title={offer.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                onClick={() => onFavorite(offer, !offer.favorite)}
                className="flex size-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
              >
                <motion.span
                  key={String(offer.favorite)}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={spring.snappy}
                  className="flex"
                >
                  <Star
                    aria-hidden
                    className={cn("size-4", offer.favorite && "fill-[#f5b301] text-[#f5b301]")}
                  />
                </motion.span>
              </button>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-label={open ? "Replier l'offre" : "Déplier l'offre"}
              className="flex size-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
            >
              <ChevronDown
                aria-hidden
                className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
              />
            </button>
          </div>
          {offer.favorite && !application && onCreateApplication && (
            <Button
              variant="secondary"
              size="sm"
              loading={creating}
              title="Ajoute l'offre à tes candidatures, au statut « À envoyer »"
              onClick={() => {
                setCreating(true);
                onCreateApplication(offer).finally(() => setCreating(false));
              }}
            >
              <FilePlus2 aria-hidden />
              Créer la candidature
            </Button>
          )}
        </div>
      </div>

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
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" asChild>
                    <a href={offer.url} target="_blank" rel="noreferrer">
                      Voir l&apos;offre
                      <ExternalLink aria-hidden />
                    </a>
                  </Button>
                  <Button variant="ai" size="sm" asChild>
                    <Link href={`/offres/${offer.id}`}>
                      <Sparkles aria-hidden />
                      Préparer la candidature
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
