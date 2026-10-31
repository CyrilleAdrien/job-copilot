"use client";

import { ArrowUpRight, Check, FileText, Mail, Trash2, X } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  deleteApplication,
  documentPdfUrl,
  fetchApplication,
  mailtoUrl,
  statusOrder,
  updateApplication,
  type Application,
  type ApplicationChanges,
} from "@/lib/applications";
import { spring } from "@/lib/motion";
import { applicationStatuses, type ApplicationStatus } from "@/lib/statuses";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const sourceLabels = { manual: "à la main", mail: "d'après un mail", system: "automatique" };

/** Fiche d'une candidature, en panneau latéral : statut, documents, contact, notes, historique. */
export function ApplicationSheet({
  id,
  signature,
  onClose,
  onChange,
  onDelete,
}: {
  id: string | null;
  signature: string;
  onClose: () => void;
  onChange: (application: Application) => void;
  onDelete: (id: string) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", close);
  }, [id, onClose]);

  return (
    <AnimatePresence>
      {id && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal
            aria-label="Fiche de candidature"
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={spring.smooth}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col overflow-y-auto border-l border-border bg-background shadow-[0_0_48px_-12px_rgb(0_0_0/0.3)] outline-none"
          >
            <SheetContent key={id} id={id} signature={signature} onClose={onClose} onChange={onChange} onDelete={onDelete} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetContent({
  id,
  signature,
  onClose,
  onChange,
  onDelete,
}: {
  id: string;
  signature: string;
  onClose: () => void;
  onChange: (application: Application) => void;
  onDelete: (id: string) => void;
}) {
  const [application, setApplication] = useState<Application | null>(null);
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    fetchApplication(id)
      .then((loaded) => {
        setApplication(loaded);
        setNotes(loaded.notes);
        setEmail(loaded.contact_email ?? "");
      })
      .catch(setError);
  }, [id]);

  async function save(changes: ApplicationChanges) {
    setError(null);
    try {
      const updated = await updateApplication(id, changes);
      setApplication(updated);
      onChange(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  async function remove() {
    try {
      await deleteApplication(id);
      onDelete(id);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  const move = (status: ApplicationStatus) => save({ status });

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-3">
        {application ? (
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-[20px] font-semibold leading-tight tracking-tight">{application.title}</h2>
            <p className="text-[14px] text-text-secondary">
              {[application.company, application.location].filter(Boolean).join(" · ") || "Entreprise non précisée"}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        )}
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onClose} aria-label="Fermer">
          <X aria-hidden />
        </Button>
      </header>

      <AnimatePresence>{error && <ErrorBanner error={error} />}</AnimatePresence>

      {application && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={application.status} />
            <Menu
              label="Changer le statut"
              triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 text-[13px] font-medium transition-colors hover:bg-surface-hover"
              trigger={<>Changer le statut</>}
              items={statusOrder
                .filter((status) => status !== application.status)
                .map((status) => {
                  const { label, icon: Icon } = applicationStatuses[status];
                  return { label, icon: <Icon aria-hidden />, onSelect: () => move(status) };
                })}
            />
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-1 text-[12px] text-success"
                >
                  <Check className="size-3.5" aria-hidden />
                  Enregistré
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap gap-2">
            {application.url && (
              <Button variant="secondary" size="sm" asChild>
                <a href={application.url} target="_blank" rel="noreferrer">
                  Offre en ligne
                  <ArrowUpRight aria-hidden />
                </a>
              </Button>
            )}
            {application.offer_id !== null && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/offres/${application.offer_id}`}>Fiche de l&apos;offre</Link>
              </Button>
            )}
            {application.contact_email && (
              <Button variant="secondary" size="sm" asChild>
                <a href={mailtoUrl(application, signature)}>
                  <Mail aria-hidden />
                  Écrire au recruteur
                </a>
              </Button>
            )}
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold">Documents</h3>
            <div className="grid grid-cols-2 gap-2">
              <DocumentLink label="CV" id={application.cv_document_id} />
              <DocumentLink label="Lettre" id={application.letter_document_id} />
            </div>
            {!application.cv_document_id && application.offer_id !== null && (
              <p className="text-[12px] text-text-tertiary">
                Génère-les depuis la fiche de l&apos;offre : ils seront joints automatiquement.
              </p>
            )}
          </section>

          <Input
            label="Contact du recruteur"
            type="email"
            value={email}
            placeholder="recrutement@entreprise.fr"
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => email !== (application.contact_email ?? "") && save({ contact_email: email || null })}
          />

          <Textarea
            label="Notes"
            value={notes}
            rows={5}
            placeholder="Interlocuteur, questions à préparer, points à relancer..."
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => notes !== application.notes && save({ notes })}
          />

          <section className="flex flex-col gap-3">
            <h3 className="text-[13px] font-semibold">Historique</h3>
            <ol className="flex flex-col gap-3 border-l border-border pl-4">
              {[...application.events].reverse().map((event, index) => {
                const { label, icon: Icon } = applicationStatuses[event.to_status];
                return (
                  <li key={`${event.created_at}-${index}`} className="relative flex flex-col gap-0.5">
                    <span className="absolute -left-[22.5px] top-0.5 flex size-[13px] items-center justify-center rounded-full bg-background">
                      <Icon className="size-3 text-text-tertiary" aria-hidden />
                    </span>
                    <span className="text-[13px] font-medium">{label}</span>
                    <span className="text-[12px] text-text-tertiary">
                      {dateFormatter.format(new Date(event.created_at))} · {sourceLabels[event.source]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="border-t border-border pt-4">
            <AnimatePresence mode="wait" initial={false}>
              {confirming ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="alertdialog"
                  aria-label="Confirmer la suppression"
                  className="flex flex-wrap items-center gap-3 rounded-[10px] border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm"
                >
                  <p className="flex-1 text-text-secondary">Supprimer cette candidature et son historique ?</p>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" size="sm" onClick={remove}>
                    Supprimer
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="delete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => setConfirming(true)}>
                    <Trash2 aria-hidden />
                    Supprimer la candidature
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

function DocumentLink({ label, id }: { label: string; id: string | null }) {
  if (!id) {
    return (
      <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[13px] text-text-tertiary">
        <FileText className="size-4" aria-hidden />
        {label} à générer
      </div>
    );
  }
  return (
    <a
      href={documentPdfUrl(id)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-hover"
    >
      <FileText className="size-4 text-accent-strong" aria-hidden />
      {label}
      <ArrowUpRight className="ml-auto size-3.5 text-text-tertiary" aria-hidden />
    </a>
  );
}
