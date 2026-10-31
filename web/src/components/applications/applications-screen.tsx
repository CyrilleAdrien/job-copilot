"use client";

import { FileStack, FileText, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { ApplicationSheet } from "@/components/applications/application-sheet";
import { FilterBar } from "@/components/applications/filter-bar";
import { Kanban } from "@/components/applications/kanban";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorBanner } from "@/components/profile/error-banner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProfile } from "@/lib/api";
import {
  ApiError,
  createApplication,
  emptyFilters,
  fetchApplications,
  filterApplications,
  statusOrder,
  updateApplication,
  type ApplicationSummary,
  type Filters,
} from "@/lib/applications";
import { timeAgo } from "@/lib/jobs";
import { fadeUp, spring } from "@/lib/motion";
import type { ApplicationStatus } from "@/lib/statuses";

type View = "kanban" | "list";
const VIEW_KEY = "jobcopilot.applications.view";

export function ApplicationsScreen() {
  const [items, setItems] = useState<ApplicationSummary[] | null>(null);
  const [view, setView] = useState<View>("kanban");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [now] = useState(() => new Date());
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [searchNames, setSearchNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchApplications().then(setItems).catch((e: ApiError) => {
      setError(e);
      setItems([]);
    });
    fetchProfile()
      .then((profile) => {
        setSignature(profile?.identity.full_name ?? "");
        setSearchNames(Object.fromEntries((profile?.searches ?? []).map((search) => [search.id, search.name])));
      })
      .catch(() => undefined);
    try {
      const stored = window.localStorage.getItem(VIEW_KEY);
      if (stored === "kanban" || stored === "list") setView(stored);
    } catch {}
    setOpen(new URLSearchParams(window.location.search).get("id"));
  }, []);

  // La fiche ouverte est dans l'URL : lien partageable depuis l'offre, retour arrière qui la ferme.
  const show = useCallback((id: string | null) => {
    setOpen(id);
    const url = id ? `/candidatures?id=${id}` : "/candidatures";
    window.history.replaceState(null, "", url);
  }, []);
  const close = useCallback(() => show(null), [show]);

  function changeView(next: View) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {}
  }

  const replace = (updated: ApplicationSummary) =>
    setItems((current) => current && current.map((item) => (item.id === updated.id ? updated : item)));

  const visible = items ? filterApplications(items, filters, now) : [];

  /** Déplacement optimiste : la carte change de colonne tout de suite, et revient si l'appel échoue. */
  function move(id: string, status: ApplicationStatus) {
    const before = items;
    setItems(
      (current) =>
        current &&
        current.map((item) => (item.id === id ? { ...item, status, updated_at: new Date().toISOString() } : item)),
    );
    updateApplication(id, { status })
      .then(replace)
      .catch((e) => {
        setItems(before);
        setError(e as ApiError);
      });
  }

  return (
    <>
      <PageHeader
        title="Candidatures"
        description="Chaque candidature, de l'envoi à la réponse."
        actions={
          <Button variant="secondary" onClick={() => setAdding((value) => !value)}>
            <Plus aria-hidden />
            Ajouter une candidature
          </Button>
        }
      />

      <AnimatePresence>
        {adding && (
          <NewApplication
            onCancel={() => setAdding(false)}
            onCreated={(created) => {
              setItems((current) => [created, ...(current ?? [])]);
              setAdding(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{error && <div className="pb-4"><ErrorBanner error={error} /></div>}</AnimatePresence>

      {items === null ? (
        <div className="flex gap-3" aria-busy aria-label="Chargement des candidatures">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-72 w-64 shrink-0 rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Aucune candidature pour l'instant"
          description="Ouvre une offre et clique sur « Postuler » : la fiche est créée avec ton CV et ta lettre. Tu peux aussi en ajouter une à la main."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/offres">Voir les offres</Link>
              </Button>
              <Button variant="secondary" onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                Ajouter une candidature
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <SegmentedControl
              label="Affichage"
              segments={[
                { value: "kanban", label: "Kanban" },
                { value: "list", label: "Liste" },
              ]}
              value={view}
              onChange={changeView}
            />
            <span className="text-[13px] tabular-nums text-text-tertiary" aria-live="polite">
              {visible.length === items.length
                ? `${items.length} candidature${items.length > 1 ? "s" : ""}`
                : `${visible.length} sur ${items.length}`}
            </span>
          </div>
          <FilterBar items={items} filters={filters} searchNames={searchNames} onChange={setFilters} />
          {visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucune candidature ne correspond"
              description="Change ou retire un filtre pour en voir plus."
              action={
                <Button variant="secondary" onClick={() => setFilters(emptyFilters)}>
                  Réinitialiser les filtres
                </Button>
              }
            />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={view} {...fadeUp} transition={spring.smooth}>
                {view === "kanban" ? (
                  <Kanban
                    items={visible}
                    columns={filters.statuses.length ? statusOrder.filter((s) => filters.statuses.includes(s)) : statusOrder}
                    now={now}
                    onOpen={show}
                    onMove={move}
                  />
                ) : (
                  <ApplicationList items={visible} now={now} onOpen={show} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      <ApplicationSheet
        id={open}
        signature={signature}
        onClose={close}
        onChange={replace}
        onDelete={(id) => {
          setItems((current) => current && current.filter((item) => item.id !== id));
          close();
        }}
      />
    </>
  );
}

function ApplicationList({
  items,
  now,
  onOpen,
}: {
  items: ApplicationSummary[];
  now: Date;
  onOpen: (id: string) => void;
}) {
  const sorted = [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {sorted.map((item) => (
        <motion.li key={item.id} layout="position" transition={spring.smooth}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{item.title}</span>
              <span className="truncate text-[13px] text-text-secondary">
                {[item.company, item.location].filter(Boolean).join(" · ") || "Entreprise non précisée"}
              </span>
            </div>
            {(item.cv_document_id || item.letter_document_id) && (
              <FileText className="size-4 shrink-0 text-text-tertiary" aria-label="Documents joints" />
            )}
            <span className="hidden w-28 shrink-0 text-right text-[13px] tabular-nums text-text-tertiary sm:block">
              {timeAgo(item.applied_at ?? item.created_at, now)}
            </span>
            <span className="w-28 shrink-0 text-right">
              <StatusBadge status={item.status} />
            </span>
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

function NewApplication({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (application: ApplicationSummary) => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      onCreated(
        await createApplication({ title: title.trim(), company: company.trim() || undefined, url: url.trim() || undefined }),
      );
    } catch (e) {
      setError(e as ApiError);
      setSaving(false);
    }
  }

  return (
    <motion.form
      {...fadeUp}
      transition={spring.smooth}
      onSubmit={submit}
      className="mb-5 flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card"
      aria-label="Nouvelle candidature"
    >
      <p className="text-[13px] text-text-secondary">
        Pour une offre trouvée ailleurs (site carrière, réseau). Les offres de l&apos;app passent par « Postuler ».
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Poste" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <Input label="Entreprise" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Input label="Lien de l'offre" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      </div>
      <AnimatePresence>{error && <ErrorBanner error={error} />}</AnimatePresence>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={saving} disabled={!title.trim()}>
          Ajouter
        </Button>
      </div>
    </motion.form>
  );
}
