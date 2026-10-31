"use client";

import { ArrowUpRight, BellRing, Check, Mail, Plus, Repeat } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorBanner } from "@/components/profile/error-banner";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { toneBar, toneText } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProfile } from "@/lib/api";
import { ApiError, followUpApplication, mailtoUrl, statusOrder } from "@/lib/applications";
import { fetchStats, percent, type FollowUp, type Stats } from "@/lib/dashboard";
import { fadeUp, spring } from "@/lib/motion";
import { applicationStatuses } from "@/lib/statuses";
import { cn } from "@/lib/utils";

const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
/** Relances affichées avant « Voir tout » : les plus anciennes d'abord. */
const FOLLOW_UP_PREVIEW = 5;

export function DashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [signature, setSignature] = useState("");
  const [allFollowUps, setAllFollowUps] = useState(false);

  const load = useCallback(() => {
    fetchStats()
      .then(setStats)
      .catch((e: ApiError) => setError(e));
  }, []);

  useEffect(() => {
    load();
    fetchProfile()
      .then((profile) => setSignature(profile?.identity.full_name ?? ""))
      .catch(() => undefined);
  }, [load]);

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

      {stats === null ? (
        <div className="flex flex-col gap-6" aria-busy aria-label="Chargement du tableau de bord">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[118px] rounded-card" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-card" />
        </div>
      ) : stats.total === 0 ? (
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Candidatures envoyées" value={<AnimatedNumber value={stats.sent} />} detail={`${stats.by_status.draft} à envoyer`} />
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
              label="Entretiens et offres"
              value={<AnimatedNumber value={stats.by_status.interview + stats.by_status.offer} />}
              detail={`${stats.by_status.offer} offre${stats.by_status.offer > 1 ? "s" : ""} reçue${stats.by_status.offer > 1 ? "s" : ""}`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Envois par semaine</CardTitle>
                <CardDescription>Les 12 dernières semaines, d&apos;après la date d&apos;envoi.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <WeeklyChart weeks={stats.weekly} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Par statut</CardTitle>
                <CardDescription>{stats.total} candidatures au total.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3.5 pt-5">
                {statusOrder.map((status) => {
                  const { label, icon: Icon, tone } = applicationStatuses[status];
                  const count = stats.by_status[status];
                  const share = stats.total ? count / stats.total : 0;
                  return (
                    <div key={status} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[13px]">
                        <Icon className={cn("size-4", toneText[tone])} strokeWidth={1.75} aria-hidden />
                        <span className="text-text">{label}</span>
                        <span className="ml-auto font-medium tabular-nums text-text">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-background-subtle">
                        <motion.div
                          className={cn("h-full rounded-full", toneBar[tone])}
                          initial={{ width: 0 }}
                          animate={{ width: `${share * 100}%` }}
                          transition={spring.smooth}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

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
      <span className="text-[30px] font-semibold leading-none tracking-tight tabular-nums">{value}</span>
      <span className="text-[12px] text-text-tertiary">{detail}</span>
    </Card>
  );
}
