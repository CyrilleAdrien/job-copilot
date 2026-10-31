"use client";

import { Archive, Copy, Filter, KeyRound, Plus, RefreshCw, SearchX, Star, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { JobCard } from "@/components/jobs/job-card";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { JobCardSkeleton } from "@/components/ui/skeleton";
import { archiveSearch, deleteSearch, fetchProfile } from "@/lib/api";
import {
  ApiError,
  fetchOffers,
  refreshOffers,
  setFavorite,
  sortOrders,
  timeAgo,
  windows,
  type OfferList,
  type RefreshResult,
  type SortOrder,
  type SourceStatus,
  type Window,
} from "@/lib/jobs";
import { fadeUp, spring } from "@/lib/motion";
import type { Profile, SearchProfile } from "@/lib/profile";
import { pickSearch, storeSearch, storedSearch } from "@/lib/search-choice";
import { cn } from "@/lib/utils";

export function OffersScreen() {
  const [searches, setSearches] = useState<SearchProfile[]>([]);
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [days, setDays] = useState<Window | null>(null);
  const [sort, setSort] = useState<SortOrder>("date");
  const [list, setList] = useState<OfferList | null>(null);
  const [refresh, setRefresh] = useState<RefreshResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [noProfile, setNoProfile] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [view, setView] = useState<"all" | "favorites">("all");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const latest = useRef(0);

  const fail = useCallback((e: ApiError) => {
    if (e.status === 409 && e.message.includes("profil")) setNoProfile(true);
    else setError(e);
  }, []);

  /** Interroge les sources (cache de 15 min côté serveur) puis relit la liste. */
  const sync = useCallback(
    async (window: Window, order: SortOrder, searchId: string | undefined, force = false) => {
      const call = ++latest.current;
      setSyncing(true);
      setError(null);
      try {
        const result = await refreshOffers(window, force, searchId);
        if (call === latest.current) setRefresh(result);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 409 && e.message.includes("cours"))) {
          fail(e as ApiError);
        }
      }
      try {
        const offers = await fetchOffers(order, window, searchId);
        if (call === latest.current) setList(offers);
      } catch (e) {
        fail(e as ApiError);
      } finally {
        if (call === latest.current) {
          setSyncing(false);
          setNow(new Date());
        }
      }
    },
    [fail],
  );

  /** Liste d'un profil de recherche, dans sa fenêtre de publication par défaut, puis collecte. */
  const open = useCallback(
    (searchId: string | undefined, order: SortOrder) =>
      fetchOffers(order, undefined, searchId)
        .then((offers) => {
          setList(offers);
          setDays(offers.max_age_days);
          return sync(offers.max_age_days, order, searchId);
        })
        .catch(fail),
    [sync, fail],
  );

  useEffect(() => {
    fetchProfile()
      .then((profile) => {
        if (!profile) return setNoProfile(true);
        const active = profile.searches.filter((item) => !item.archived);
        const chosen = pickSearch(
          active.map((item) => item.id),
          storedSearch(),
        );
        setSearches(active);
        setSearch(chosen);
        return open(chosen, "date");
      })
      .catch(fail);
  }, [open, fail]);

  function changeSearch(searchId: string) {
    setSearch(searchId);
    setView("all");
    setConfirmDelete(false);
    storeSearch(searchId);
    setList(null);
    setRefresh(null);
    open(searchId, sort);
  }

  function changeSort(order: SortOrder) {
    setSort(order);
    if (view === "favorites") fetchOffers(order, undefined, search, true).then(setList).catch(fail);
    else if (days) fetchOffers(order, days, search).then(setList).catch(fail);
  }

  function changeView(next: "all" | "favorites") {
    setView(next);
    setList(null);
    if (next === "favorites") fetchOffers(sort, undefined, search, true).then(setList).catch(fail);
    else if (days) fetchOffers(sort, days, search).then(setList).catch(fail);
  }

  /** Bascule optimiste : l'étoile change tout de suite, et revient en arrière si l'appel échoue. */
  function toggleFavorite(offerId: number, favorite: boolean) {
    const apply = (value: boolean) =>
      setList((current) =>
        current && {
          ...current,
          items:
            view === "favorites" && !value
              ? current.items.filter((item) => item.id !== offerId)
              : current.items.map((item) => (item.id === offerId ? { ...item, favorite: value } : item)),
          total: view === "favorites" && !value ? current.total - 1 : current.total,
        },
      );
    const before = list;
    apply(favorite);
    setFavorite(offerId, favorite, search).catch((e) => {
      setList(before);
      fail(e as ApiError);
    });
  }

  /** Après archivage ou suppression : garde les recherches actives et ouvre la suivante. */
  function afterSearchChange(profile: Profile) {
    const active = profile.searches.filter((item) => !item.archived);
    setSearches(active);
    setConfirmDelete(false);
    if (active.length > 0) changeSearch(active[0].id);
  }

  function archiveCurrent() {
    if (!search) return;
    setError(null);
    archiveSearch(search).then(afterSearchChange).catch(fail);
  }

  function deleteCurrent() {
    if (!search) return;
    setError(null);
    deleteSearch(search).then(afterSearchChange).catch((e) => {
      setConfirmDelete(false);
      fail(e as ApiError);
    });
  }

  function changeWindow(window: Window) {
    setDays(window);
    fetchOffers(sort, window, search).then(setList).catch(fail);
    sync(window, sort, search);
  }

  const current = searches.find((item) => item.id === search);

  if (noProfile) {
    return (
      <>
        <PageHeader title="Offres" description="Les offres qui correspondent à ton profil." />
        <EmptyState
          icon={UserRound}
          title="Commence par ton profil"
          description="Les offres sont cherchées et triées à partir de tes critères : postes, technologies, lieux."
          action={
            <Button asChild>
              <Link href="/bienvenue">Configurer mon profil</Link>
            </Button>
          }
        />
      </>
    );
  }

  const sources = refresh?.sources.filter((source) => source.status !== "disabled") ?? [];
  const noSource = refresh !== null && sources.length === 0;

  return (
    <>
      <PageHeader
        title="Offres"
        description="Les plus récentes d'abord, filtrées selon ton profil."
        actions={
          <Button
            variant="secondary"
            onClick={() => days && sync(days, sort, search, true)}
            disabled={!days || syncing}
          >
            <RefreshCw aria-hidden className={cn(syncing && "animate-spin")} />
            Actualiser
          </Button>
        }
      />

      {searches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-3">
          {searches.length > 1 && (
            <SegmentedControl
              label="Recherche"
              segments={searches.map((item) => ({ value: item.id, label: item.name }))}
              value={search ?? searches[0].id}
              onChange={changeSearch}
            />
          )}
          <Menu
            label="Nouvelle recherche"
            trigger={<Plus className="size-4" aria-hidden />}
            items={[
              { label: "Nouvelle recherche", href: "/bienvenue?recherche=nouvelle", icon: <Plus aria-hidden /> },
              ...searches.map((item) => ({
                label: `À partir de « ${item.name} »`,
                href: `/bienvenue?recherche=${encodeURIComponent(item.id)}`,
                icon: <Copy aria-hidden />,
              })),
              ...(current
                ? [
                    {
                      label: `Archiver « ${current.name} »`,
                      icon: <Archive aria-hidden />,
                      onSelect: archiveCurrent,
                      separated: true,
                    },
                    {
                      label: `Supprimer « ${current.name} »`,
                      icon: <Trash2 aria-hidden />,
                      onSelect: () => setConfirmDelete(true),
                      tone: "danger" as const,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}

      <AnimatePresence>
        {confirmDelete && current && (
          <motion.div {...fadeUp} transition={spring.smooth} className="pb-3">
            <div
              role="alertdialog"
              aria-label="Confirmer la suppression"
              className="flex flex-wrap items-center gap-3 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm"
            >
              <Trash2 className="size-4 shrink-0 text-danger" aria-hidden />
              <p className="flex-1 text-text-secondary">
                Supprimer la recherche <span className="font-medium text-text">« {current.name} »</span> et
                ses favoris ? Pour la mettre de côté sans rien perdre, archive-la plutôt.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Annuler
                </Button>
                <Button variant="secondary" size="sm" onClick={archiveCurrent}>
                  Archiver
                </Button>
                <Button variant="danger" size="sm" onClick={deleteCurrent}>
                  Supprimer
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Affichage"
            segments={[
              { value: "all", label: "Toutes" },
              { value: "favorites", label: "Favoris" },
            ]}
            value={view}
            onChange={changeView}
          />
          {view === "all" && (
            <SegmentedControl
              label="Date de publication"
              segments={windows}
              value={days ? (String(days) as `${Window}`) : "7"}
              onChange={(value) => changeWindow(Number(value) as Window)}
            />
          )}
          <SegmentedControl
            label="Ordre"
            segments={sortOrders}
            value={sort}
            onChange={changeSort}
          />
        </div>
        <StatusLine syncing={syncing} list={list} refresh={refresh} sources={sources} now={now} />
      </div>

      <ProgressBar active={syncing} />

      <AnimatePresence>
        {error && (
          <div className="pb-4">
            <ErrorBanner error={error} />
          </div>
        )}
      </AnimatePresence>

      {noSource && (
        <motion.div {...fadeUp} transition={spring.smooth} className="pb-4">
          <div className="flex gap-3 rounded-card border border-border bg-background-subtle p-4 text-sm">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-text-tertiary" aria-hidden />
            <p className="text-text-secondary">
              <span className="font-medium text-text">Aucune source n&apos;est configurée.</span>{" "}
              Ajoute tes clés France Travail ou Adzuna dans le fichier <code>.env</code>, ou
              active <code>JOBS_DEMO=true</code> pour essayer avec des offres fictives.
            </p>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {view === "all" && list && list.hidden > 0 && current?.match_mode === "skills" && (
          <motion.div {...fadeUp} transition={spring.smooth} className="pb-4">
            <div className="flex items-center gap-3 rounded-card border border-border bg-background-subtle px-4 py-3 text-sm">
              <Filter className="size-4 shrink-0 text-text-tertiary" aria-hidden />
              <p className="flex-1 text-text-secondary">
                {list.hidden} offre{list.hidden > 1 ? "s" : ""} du métier masquée{list.hidden > 1 ? "s" : ""} : elle
                {list.hidden > 1 ? "s citent" : " cite"} moins de {current.min_skills} de tes compétences choisies.
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/bienvenue">Ajuster</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {list === null ? (
        <div className="flex flex-col gap-3" aria-busy aria-label="Chargement des offres">
          {Array.from({ length: 5 }, (_, index) => (
            <JobCardSkeleton key={index} />
          ))}
        </div>
      ) : list.items.length === 0 && view === "favorites" ? (
        <EmptyState
          icon={Star}
          title="Aucun favori pour cette recherche"
          description="Touche l'étoile d'une offre pour la garder ici. Les favoris ne sont jamais purgés."
          action={
            <Button variant="secondary" onClick={() => changeView("all")}>
              Voir toutes les offres
            </Button>
          }
        />
      ) : list.items.length === 0 ? (
        syncing && view === "all" ? (
          <div className="flex flex-col gap-3" aria-busy aria-label="Recherche des offres">
            {Array.from({ length: 3 }, (_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={SearchX}
            title="Aucune offre sur cette période"
            description="Élargis la fenêtre de publication ou ajuste tes critères dans ton profil."
            action={
              days !== 30 ? (
                <Button variant="secondary" onClick={() => changeWindow(30)}>
                  Voir les 30 derniers jours
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {list.items.map((offer, index) => (
              <motion.li
                key={offer.id}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ ...spring.smooth, delay: Math.min(index, 10) * 0.025 }}
              >
                <JobCard
                  offer={offer}
                  now={now}
                  search={search}
                  onFavorite={(item, favorite) => toggleFavorite(item.id, favorite)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </>
  );
}

function StatusLine({
  syncing,
  list,
  refresh,
  sources,
  now,
}: {
  syncing: boolean;
  list: OfferList | null;
  refresh: RefreshResult | null;
  sources: SourceStatus[];
  now: Date;
}) {
  const refreshedAt = refresh?.refreshed_at ?? list?.refreshed_at;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-tertiary" aria-live="polite">
      {syncing ? (
        <span>Recherche en cours</span>
      ) : (
        <>
          {list && (
            <span>
              {list.total} offre{list.total > 1 ? "s" : ""}
              {refreshedAt && ` · actualisé ${timeAgo(refreshedAt, now)}`}
            </span>
          )}
          {sources.map((source) => (
            <span key={source.name} className="inline-flex items-center gap-1.5" title={source.error ?? undefined}>
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  source.status === "ok" ? "bg-success" : "bg-danger",
                )}
              />
              {source.label}
              {source.status === "error" && <span className="text-danger">indisponible</span>}
            </span>
          ))}
        </>
      )}
    </div>
  );
}

/** Barre indéterminée, fine, sous les filtres pendant la recherche. */
function ProgressBar({ active }: { active: boolean }) {
  return (
    <div className="relative mb-4 h-0.5 overflow-hidden rounded-full" aria-hidden>
      <AnimatePresence>
        {active && (
          <motion.div
            className="absolute inset-0 bg-accent-soft"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="h-full w-1/3 rounded-full bg-accent"
              animate={{ x: ["-100%", "300%"] }}
              transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
