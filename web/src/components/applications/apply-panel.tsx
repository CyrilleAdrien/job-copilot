"use client";

import { ArrowUpRight, Check, FileText, Mail, Send } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { fetchProfile } from "@/lib/api";
import {
  ApiError,
  createApplication,
  fetchApplications,
  mailtoUrl,
  updateApplication,
  type ApplicationSummary,
} from "@/lib/applications";
import { fadeUp, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * « Postuler » : ouvre l'offre dans un nouvel onglet et crée la fiche de candidature avec les
 * documents générés. L'envoi reste un geste de l'utilisateur, qui le confirme ensuite ici.
 */
export function ApplyPanel({
  offerId,
  offerUrl,
  search,
  documents,
}: {
  offerId: number;
  offerUrl: string;
  search?: string;
  /** Dernières versions générées : la fiche suit les nouvelles versions du CV et de la lettre. */
  documents: { cv_document_id?: string; letter_document_id?: string };
}) {
  const [application, setApplication] = useState<ApplicationSummary | null | undefined>(undefined);
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    fetchApplications(offerId)
      .then((items) => setApplication(items[0] ?? null))
      .catch(() => setApplication(null));
    fetchProfile()
      .then((profile) => setSignature(profile?.identity.full_name ?? ""))
      .catch(() => undefined);
  }, [offerId]);

  // Une nouvelle version (lettre modifiée, nouvelle génération) remplace celle de la fiche.
  const applicationId = application?.id;
  const outdated =
    application &&
    ((documents.cv_document_id && documents.cv_document_id !== application.cv_document_id) ||
      (documents.letter_document_id && documents.letter_document_id !== application.letter_document_id));
  useEffect(() => {
    if (!applicationId || !outdated) return;
    updateApplication(applicationId, documents).then(setApplication).catch(() => undefined);
  }, [applicationId, outdated, documents]);

  async function apply() {
    // Ouvert pendant le clic, sinon le navigateur bloque l'onglet.
    window.open(offerUrl, "_blank", "noopener,noreferrer");
    setBusy(true);
    setError(null);
    try {
      setApplication(await createApplication({ offer_id: offerId, search }));
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function markSent() {
    if (!application) return;
    setBusy(true);
    try {
      setApplication(await updateApplication(application.id, { status: "sent" }));
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  if (application === undefined) {
    return <div className="h-[132px] animate-pulse rounded-card border border-border bg-background-subtle" aria-busy />;
  }

  return (
    <motion.section
      {...fadeUp}
      transition={spring.smooth}
      aria-label="Candidature"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold">Candidature</h2>
          <p className="text-[13px] text-text-secondary">
            {application
              ? application.status === "draft"
                ? "Fiche créée. Envoie ta candidature sur le site de l'offre, puis confirme-le ici."
                : "Suivie dans tes candidatures."
              : "Ouvre l'offre dans un nouvel onglet et crée la fiche avec ton CV et ta lettre."}
          </p>
        </div>
        {application && <StatusBadge status={application.status} />}
      </div>

      {application && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
          <DocumentState label="CV" ready={Boolean(application.cv_document_id)} />
          <DocumentState label="Lettre" ready={Boolean(application.letter_document_id)} />
        </div>
      )}

      <AnimatePresence>{error && <ErrorBanner error={error} />}</AnimatePresence>

      <div className="flex flex-wrap items-center gap-2">
        {!application ? (
          <Button variant="accent" onClick={apply} loading={busy}>
            <Send aria-hidden />
            Postuler
          </Button>
        ) : (
          <>
            {application.status === "draft" && (
              <Button variant="accent" onClick={markSent} loading={busy}>
                <Check aria-hidden />
                Marquer comme envoyée
              </Button>
            )}
            <Button variant="secondary" asChild>
              <a href={offerUrl} target="_blank" rel="noreferrer">
                Ouvrir l&apos;offre
                <ArrowUpRight aria-hidden />
              </a>
            </Button>
            {application.contact_email && (
              <Button variant="secondary" asChild>
                <a href={mailtoUrl(application, signature)} title={application.contact_email}>
                  <Mail aria-hidden />
                  Écrire au recruteur
                </a>
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href={`/candidatures?id=${application.id}`}>Voir la fiche</Link>
            </Button>
          </>
        )}
      </div>
    </motion.section>
  );
}

function DocumentState({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", ready ? "text-text" : "text-text-tertiary")}>
      <FileText className="size-3.5" aria-hidden />
      {label}
      <span className={ready ? "text-success" : undefined}>{ready ? "joint" : "à générer"}</span>
    </span>
  );
}
