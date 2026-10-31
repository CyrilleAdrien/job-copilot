"use client";

import { Banknote, ChevronLeft, ExternalLink, House, MapPin } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { ApplyPanel } from "@/components/applications/apply-panel";
import { GenerationPanel } from "@/components/documents/generation-panel";
import { ScoreRing } from "@/components/jobs/score-ring";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  contractLabels,
  fetchOffer,
  sourceLabels,
  timeAgo,
  type OfferDetail,
} from "@/lib/jobs";
import { latestDocumentIds } from "@/lib/applications";
import type { DocumentInfo } from "@/lib/documents";
import { fadeUp, spring } from "@/lib/motion";
import { storedSearch } from "@/lib/search-choice";

export function OfferDetailScreen({ offerId }: { offerId: number }) {
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [documents, setDocuments] = useState<ReturnType<typeof latestDocumentIds>>({});
  const onDocuments = useCallback((docs: DocumentInfo[]) => setDocuments(latestDocumentIds(docs)), []);

  useEffect(() => {
    fetchOffer(offerId, storedSearch() ?? undefined).then(setOffer).catch(setError);
  }, [offerId]);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="-ml-3 w-fit" asChild>
        <Link href="/offres">
          <ChevronLeft aria-hidden />
          Offres
        </Link>
      </Button>

      {error ? (
        <ErrorBanner error={error} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {offer ? (
            <motion.article {...fadeUp} transition={spring.smooth} className="flex flex-col gap-5">
              <header className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
                    {offer.title}
                  </h1>
                  <p className="flex flex-wrap items-center gap-1.5 text-[15px] text-text-secondary">
                    {offer.company ?? "Entreprise non précisée"}
                    {offer.location && (
                      <>
                        <MapPin className="size-3.5 text-text-tertiary" aria-hidden />
                        {offer.location}
                      </>
                    )}
                  </p>
                </div>
                <ScoreRing score={offer.score} />
              </header>

              <div className="flex flex-wrap gap-1.5">
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
                {offer.matched.map((tech) => (
                  <Badge key={tech} tone="accent">
                    {tech}
                  </Badge>
                ))}
              </div>

              <div className="rounded-card border border-border bg-surface p-5 shadow-card">
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                  {offer.description || offer.snippet}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 text-[13px] text-text-tertiary">
                <span>
                  {sourceLabels[offer.source] ?? offer.source} · publiée {timeAgo(offer.published_at)}
                </span>
                <Button variant="secondary" size="sm" asChild>
                  <a href={offer.url} target="_blank" rel="noreferrer">
                    Voir l&apos;offre
                    <ExternalLink aria-hidden />
                  </a>
                </Button>
              </div>
            </motion.article>
          ) : (
            <div className="flex flex-col gap-4" aria-busy aria-label="Chargement de l'offre">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-80 rounded-card" />
            </div>
          )}
          <div className="flex flex-col gap-4 lg:sticky lg:top-8">
            {offer && (
              <ApplyPanel
                offerId={offerId}
                offerUrl={offer.url}
                search={storedSearch() ?? undefined}
                documents={documents}
              />
            )}
            <GenerationPanel offerId={offerId} onDocuments={onDocuments} />
          </div>
        </div>
      )}
    </div>
  );
}
