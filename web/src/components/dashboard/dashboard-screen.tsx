"use client";

import { ArrowUpRight, BellRing, Check, ChevronLeft, ChevronRight, Mail, Plus, Repeat, X } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { EventItem } from "@/components/calendar/event-item";
import { Donut } from "@/components/dashboard/donut";
import { SentChart } from "@/components/dashboard/sent-chart";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorBanner } from "@/components/profile/error-banner";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { toneBar, toneText } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProfile } from "@/lib/api";
import { ApiError, followUpApplication, mailtoUrl, statusOrder } from "@/lib/applications";
import { SearchOutcomes } from "@/components/dashboard/search-outcomes";
import { fetchEvents, type CalendarEvent } from "@/lib/calendar";
import {
  chartTitles,
  fetchStats,
  focusedCount,
  percent,
  periodBounds,
  periodLabel,
  sentBars,
  shiftPeriod,
  STATUS_GROUPS,
  type FollowUp,
  type Granularity,
  type Stats,
} from "@/lib/dashboard";
import { fadeUp, spring } from "@/lib/motion";
import { applicationStatuses, type ApplicationStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";

const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
/** Relances affichées avant « Voir tout » : les plus anciennes d'abord. */
const FOLLOW_UP_PREVIEW = 5;
const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "year", label: "Année" },
  { value: "month", label: "Mois" },
  { value: "week", label: "Semaine" },
  { value: "day", label: "Jour" },
];
const PROGRESSED: ApplicationStatus[] = ["technical_test", "interview", "offer"];

export function DashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [signature, setSignature] = useState("");
  const [searchNames, setSearchNames] = useState<Record<string, string>>({});
  const [allFollowUps, setAllFollowUps] = useState(false);
  const [meetings, setMeetings] = useState<CalendarEvent[]>([]);

  const [granularity, setGranularity] = useState<Granularity>("all");
  const [anchor, setAnchor] = useState(() => new Date());
  const [focus, setFocus] = useState<ApplicationStatus | null>(null);
  const latest = useRef(0);

  const load = useCallback(() => {
    const call = ++latest.current;
    const bounds = periodBounds(granularity, anchor);
    fetchStats({ from: bounds?.from, to: bounds?.to, status: focus })
      .then((loaded) => {
        // Une réponse lente ne remplace pas celle d'un filtre choisi après elle.
        if (call === latest.current) setStats(loaded);
      })
      .catch((e: ApiError) => setError(e));
  }, [granularity, anchor, focus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Facultatif : le tableau de bord reste utilisable si le service calendar ne répond pas.
    fetchEvents({ from: new Date().toISOString(), limit: 4 })
      .then(setMeetings)
      .catch(() => setMeetings([]));
    fetchProfile()
      .then((profile) => {
        setSignature(profile?.identity.full_name ?? "");
        setSearchNames(Object.fromEntries((profile?.searches ?? []).map((search) => [search.id, search.name])));
      })
      .catch(() => undefined);
  }, []);

  function chooseGranularity(next: Granularity) {
    setGranularity(next);
    setAnchor(new Date());
  }

  const nextAnchor = shiftPeriod(granularity, anchor, 1);
  const nextStart = periodBounds(granularity, nextAnchor)?.from;
  const canGoForward = nextStart !== undefined && nextStart <= new Date();

  /** La relance enregistrée change le statut : la candidature quitte la liste et les chiffres se recalculent. */
  async function markFollowedUp(item: FollowUp) {
    setStats((current) => current && { ...current, follow_ups: current.follow_ups.filter((f) => f.id !== item.id) });
    try {
      await followUpApplication(item.id);
    } catch (e) {
      setError(e as ApiError);
    }
    load();
  }

  return (
    <>
      <PageHeader title="Tableau de bord" description="Où en sont tes candidatures, et ce qui t'attend." />
      <AnimatePresence>{error && <div className="pb-4"><ErrorBanner error={error} /></div>}</AnimatePresence>

      {stats === null && error ? null : stats === null ? (
        <div className="flex flex-col gap-6" aria-busy aria-label="Chargement du tableau de bord">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[118px] rounded-card" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-card" />
        </div>
      ) : stats.all_total === 0 ? (
        <EmptyState
          icon={BellRing}
          title="Rien à suivre pour l'instant"
          description="Le tableau de bord se remplit avec tes candidatures : envois par semaine, réponses, relances à faire."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/offres">Voir les offres</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/candidatures">
                  <Plus aria-hidden />
                  Ajouter une candidature
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <motion.div {...fadeUp} transition={spring.smooth} className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl label="Période" segments={GRANULARITIES} value={granularity} onChange={chooseGranularity} />
            {granularity !== "all" && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-9" aria-label="Période précédente" onClick={() => setAnchor(shiftPeriod(granularity, anchor, -1))}>
                  <ChevronLeft aria-hidden />
                </Button>
                <span role="status" className="min-w-36 text-center text-sm first-letter:uppercase">
                  {periodLabel(granularity, anchor)}
                </span>
                <Button variant="ghost" size="icon" className="size-9" aria-label="Période suivante" disabled={!canGoForward} onClick={() => setAnchor(nextAnchor)}>
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            )}
            {focus && (
              <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setFocus(null)}>
                Statut : {applicationStatuses[focus].label}
                <X aria-hidden />
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Candidatures envoyées" value={<AnimatedNumber value={stats.sent} />} detail={`${focusedCount(stats.by_status, ["draft"], focus)} à envoyer`} />
            <Tile
              label="Taux de réponse"
              value={stats.response_rate === null ? "–" : <AnimatedNumber value={percent(stats.response_rate) ?? 0} suffix=" %" />}
              detail={`${stats.responded} réponse${stats.responded > 1 ? "s" : ""} sur ${stats.sent}`}
            />
            <Tile
              label="Délai moyen de réponse"
              value={
                stats.average_response_days === null ? (
                  "–"
                ) : (
                  <AnimatedNumber value={stats.average_response_days} format={(n) => decimal.format(n)} suffix=" j" />
                )
              }
              detail="De l'envoi à la première réponse"
            />
            <Tile
              label="Tests, entretiens et offres"
              value={
                <AnimatedNumber value={focusedCount(stats.by_status, PROGRESSED, focus)} />
              }
              detail={`${focusedCount(stats.by_status, ["offer"], focus)} offre${focusedCount(stats.by_status, ["offer"], focus) > 1 ? "s" : ""} reçue${focusedCount(stats.by_status, ["offer"], focus) > 1 ? "s" : ""}`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>{chartTitles[granularity].title}</CardTitle>
                <CardDescription>{chartTitles[granularity].description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <SentChart bars={sentBars(granularity, anchor, stats.sent_dates)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Par statut</CardTitle>
                <CardDescription>
                  {stats.total} candidature{stats.total > 1 ? "s" : ""} sur la période. Clique sur un statut pour filtrer.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 pt-4">
                {statusOrder.map((status) => {
                  const { label, icon: Icon, tone } = applicationStatuses[status];
                  const count = stats.by_status[status];
                  const share = stats.total ? count / stats.total : 0;
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={focus === status}
                      onClick={() => setFocus(focus === status ? null : status)}
                      className={cn(
                        "group flex flex-col gap-1.5 rounded-[12px] px-2.5 py-2 text-left transition-[background-color,opacity] duration-150",
                        focus === status ? "bg-accent-soft" : "hover:bg-surface-hover",
                        focus && focus !== status && "opacity-55 hover:opacity-100",
                      )}
                    >
                      <span className="flex items-center gap-2 text-[13px]">
                        <Icon className={cn("size-4 transition-transform duration-150 group-hover:scale-110", toneText[tone])} strokeWidth={1.75} aria-hidden />
                        <span className="text-text">{label}</span>
                        <span className="ml-auto font-medium tabular-nums text-text">{count}</span>
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-background-subtle">
                        <motion.span
                          className={cn("block h-full rounded-full", toneBar[tone])}
                          initial={{ width: 0 }}
                          animate={{ width: `${share * 100}%` }}
                          transition={spring.smooth}
                        />
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Où en sont tes candidatures</CardTitle>
                <CardDescription>Sur la période choisie, tous statuts confondus.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <Donut
                  ariaLabel="Répartition des candidatures par étape"
                  center={stats.total}
                  centerLabel={stats.total > 1 ? "candidatures" : "candidature"}
                  segments={STATUS_GROUPS.map((group) => ({
                    id: group.id,
                    label: group.label,
                    value: group.statuses.reduce((sum, status) => sum + stats.by_status[status], 0),
                    color: group.color,
                    dimmed: focus !== null && !group.statuses.includes(focus),
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Réponses reçues</CardTitle>
                <CardDescription>Parmi les candidatures envoyées.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <Donut
                  ariaLabel="Part des candidatures envoyées qui ont reçu une réponse"
                  center={stats.response_rate === null ? "–" : `${percent(stats.response_rate)} %`}
                  centerLabel="de réponses"
                  segments={[
                    { id: "responded", label: "Avec réponse", value: stats.responded, color: "var(--accent)" },
                    { id: "waiting", label: "Sans réponse", value: stats.sent - stats.responded, color: "var(--text)" },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <SearchOutcomes stats={stats} names={searchNames} />

          {meetings.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle>Prochains rendez-vous</CardTitle>
                  <CardDescription>Entretiens, tests techniques et relances prévus.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/calendrier">
                    Calendrier
                    <ArrowUpRight aria-hidden />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3 pt-4 md:grid-cols-2 2xl:grid-cols-4">
                {meetings.map((meeting) => (
                  <EventItem key={meeting.id} event={meeting} href={`/calendrier?event=${meeting.id}`} compact />
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Relances à faire</CardTitle>
                <CardDescription>
                  Envoyées ou relancées sans nouvelle depuis {stats.follow_up_days} jours ou plus.
                </CardDescription>
              </div>
              <span className="rounded-full bg-surface-hover px-2 text-[12px] font-medium leading-5 tabular-nums text-text-secondary">
                {stats.follow_ups.length}
              </span>
            </CardHeader>
            <CardContent className="pt-3">
              {stats.follow_ups.length === 0 ? (
                <p className="flex items-center gap-2 py-3 text-sm text-text-secondary">
                  <Check className="size-4 text-success" aria-hidden />
                  Aucune relance en attente.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {(allFollowUps ? stats.follow_ups : stats.follow_ups.slice(0, FOLLOW_UP_PREVIEW)).map((item) => (
                      <motion.li
                        key={item.id}
                        layout="position"
                        exit={{ opacity: 0, height: 0 }}
                        transition={spring.smooth}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                      >
                        <Link href={`/candidatures?id=${item.id}`} className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium hover:text-accent-strong">{item.title}</span>
                          <span className="truncate text-[12px] text-text-tertiary">
                            {item.company ?? "Entreprise non précisée"} · {applicationStatuses[item.status].label.toLowerCase()} il y a{" "}
                            {item.days} j
                          </span>
                        </Link>
                        <div className="flex items-center gap-1.5">
                          {item.contact_email ? (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={mailtoUrl(item, signature)}>
                                <Mail aria-hidden />
                                Écrire
                              </a>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/candidatures?id=${item.id}`}>
                                Ouvrir
                                <ArrowUpRight aria-hidden />
                              </Link>
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" onClick={() => markFollowedUp(item)}>
                            <Repeat aria-hidden />
                            Relancée
                          </Button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
              {stats.follow_ups.length > FOLLOW_UP_PREVIEW && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAllFollowUps((value) => !value)}>
                  {allFollowUps ? "Réduire" : `Voir les ${stats.follow_ups.length - FOLLOW_UP_PREVIEW} autres`}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  );
}

function Tile({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <span className="text-[30px] font-medium leading-none tabular-nums">{value}</span>
      <span className="text-[12px] text-text-tertiary">{detail}</span>
    </Card>
  );
}
