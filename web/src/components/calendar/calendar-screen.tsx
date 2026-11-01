"use client";

import { AlertCircle, CalendarDays, Plus, Settings } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EventEditor, type EditorTarget } from "@/components/calendar/event-editor";
import { EventItem } from "@/components/calendar/event-item";
import { MonthView } from "@/components/calendar/month-view";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { fetchApplications, type ApplicationSummary } from "@/lib/applications";
import {
  dayKey,
  eventKinds,
  eventsByDay,
  fetchCalendarAccounts,
  fetchEvents,
  type CalendarAccount,
  type CalendarEvent,
  type EventKind,
} from "@/lib/calendar";
import { fadeUp, spring } from "@/lib/motion";

/** Événements à venir affichés à droite du mois. */
const UPCOMING = 6;

export function CalendarScreen() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [account, setAccount] = useState<CalendarAccount | null>(null);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const [loaded, accounts] = await Promise.all([fetchEvents(), fetchCalendarAccounts()]);
      setEvents(loaded);
      setAccount(accounts[0] ?? null);
    } catch (e) {
      setError(e as ApiError);
    }
    fetchApplications()
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  useEffect(() => {
    load();
    // Lien depuis la fiche de candidature ou la boîte de réception : ?new=1&application_id=...&kind=...
    const params = new URLSearchParams(window.location.search);
    if (params.get("new")) {
      setTarget({
        mode: "create",
        application_id: params.get("application_id") ?? undefined,
        kind: (params.get("kind") as EventKind | null) ?? undefined,
        day: dayKey(new Date(Date.now() + 86400000)),
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [load]);

  // Un lien ?event=<id> ouvre l'événement une fois la liste chargée.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("event");
    const found = id && events?.find((event) => event.id === id);
    if (found) {
      setMonth(new Date(new Date(found.starts_at).getFullYear(), new Date(found.starts_at).getMonth(), 1));
      setTarget({ mode: "edit", event: found });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [events]);

  const days = useMemo(() => eventsByDay(events ?? []), [events]);
  const byId = useMemo(() => new Map(applications.map((item) => [item.id, item])), [applications]);
  const upcoming = (events ?? []).filter((event) => new Date(event.ends_at) >= now).slice(0, UPCOMING);
  const close = useCallback(() => setTarget(null), []);

  function saved(event: CalendarEvent) {
    setTarget(null);
    setEvents((current) =>
      [...(current ?? []).filter((item) => item.id !== event.id), event].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    );
    const label = eventKinds[event.kind].label;
    setNotice(
      event.status_changed ? `Événement ajouté. La candidature est passée à « ${label} ».` : "Événement enregistré.",
    );
    if (event.status_changed) fetchApplications().then(setApplications).catch(() => undefined);
    fetchCalendarAccounts()
      .then((accounts) => setAccount(accounts[0] ?? null))
      .catch(() => undefined);
  }

  function deleted(id: string) {
    setTarget(null);
    setEvents((current) => (current ?? []).filter((item) => item.id !== id));
    setNotice("Événement supprimé.");
  }

  return (
    <>
      <PageHeader
        title="Calendrier"
        description="Entretiens, tests techniques et relances, dans l'app et dans ton calendrier."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/reglages#calendrier">
                {account?.last_error ? <AlertCircle className="text-danger" aria-hidden /> : <Settings aria-hidden />}
                Réglages
              </Link>
            </Button>
            <Button onClick={() => setTarget({ mode: "create", day: dayKey(new Date(now.getTime() + 86400000)) })}>
              <Plus aria-hidden />
              Nouvel événement
            </Button>
          </>
        }
      />
      <AnimatePresence>{error && <div className="pb-4"><ErrorBanner error={error} /></div>}</AnimatePresence>
      <AnimatePresence>
        {notice && (
          <motion.p
            {...fadeUp}
            transition={spring.smooth}
            role="status"
            className="mb-4 rounded-card border border-border bg-background-subtle px-4 py-3 text-sm text-text-secondary"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      {events === null ? (
        error ? null : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]" aria-busy aria-label="Chargement du calendrier">
            <Skeleton className="h-[640px] rounded-card" />
            <Skeleton className="h-[420px] rounded-card" />
          </div>
        )
      ) : (
        <motion.div {...fadeUp} transition={spring.smooth} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="p-5">
            <MonthView
              month={month}
              days={days}
              today={now}
              onMonth={setMonth}
              onDay={(day) => setTarget({ mode: "create", day })}
              onEvent={(event) => setTarget({ mode: "edit", event })}
            />
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>À venir</CardTitle>
                <CardDescription>
                  {upcoming.length ? "Les prochains rendez-vous." : "Rien de prévu pour l'instant."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5 pt-4">
                {upcoming.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center text-[13px] text-text-secondary">
                    <CalendarDays className="size-5 text-text-tertiary" aria-hidden />
                    Clique sur un jour pour ajouter un entretien.
                  </div>
                ) : (
                  upcoming.map((event) => (
                    <EventItem
                      key={event.id}
                      event={event}
                      now={now}
                      application={event.application_id ? byId.get(event.application_id) : undefined}
                      onOpen={() => setTarget({ mode: "edit", event })}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      <EventEditor target={target} applications={applications} onClose={close} onSaved={saved} onDeleted={deleted} />
    </>
  );
}
