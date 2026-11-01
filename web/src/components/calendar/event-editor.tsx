"use client";

import { Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import type { ApplicationSummary } from "@/lib/applications";
import {
  createEvent,
  defaultTitle,
  deleteEvent,
  durationMinutes,
  eventKinds,
  isoToLocal,
  kindOrder,
  localToIso,
  updateEvent,
  type CalendarEvent,
  type EventKind,
} from "@/lib/calendar";
import { spring } from "@/lib/motion";
import { applicationStatuses } from "@/lib/statuses";

export type EditorTarget =
  | { mode: "create"; day?: string; application_id?: string; kind?: EventKind }
  | { mode: "edit"; event: CalendarEvent };

const DURATIONS = [30, 45, 60, 90, 120];
/** Statuts que planifier un entretien ou un test fait avancer. */
const FORWARD: Partial<Record<EventKind, string[]>> = {
  technical_test: ["sent", "followed_up"],
  interview: ["sent", "followed_up", "technical_test"],
};

const selectClass =
  "h-10 w-full rounded-[10px] border border-border-strong bg-surface px-3 text-sm text-text transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none";

/** Panneau latéral de création ou de modification d'un événement. */
export function EventEditor({
  target,
  applications,
  onClose,
  onSaved,
  onDeleted,
}: {
  target: EditorTarget | null;
  applications: ApplicationSummary[];
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onDeleted: (id: string) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!target) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", close);
  }, [target, onClose]);

  return (
    <AnimatePresence>
      {target && (
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
            aria-label={target.mode === "create" ? "Nouvel événement" : "Modifier l'événement"}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={spring.smooth}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col overflow-y-auto border-l border-border bg-background shadow-[0_0_48px_-12px_rgb(0_0_0/0.3)] outline-none"
          >
            <EditorForm
              key={target.mode === "edit" ? target.event.id : "new"}
              target={target}
              applications={applications}
              onClose={onClose}
              onSaved={onSaved}
              onDeleted={onDeleted}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function EditorForm({
  target,
  applications,
  onClose,
  onSaved,
  onDeleted,
}: {
  target: EditorTarget;
  applications: ApplicationSummary[];
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onDeleted: (id: string) => void;
}) {
  const existing = target.mode === "edit" ? target.event : null;
  const start = existing ? isoToLocal(existing.starts_at) : null;
  const [kind, setKind] = useState<EventKind>(existing?.kind ?? (target.mode === "create" ? target.kind : undefined) ?? "interview");
  const [applicationId, setApplicationId] = useState(
    existing?.application_id ?? (target.mode === "create" ? target.application_id : undefined) ?? "",
  );
  const application = applications.find((item) => item.id === applicationId);
  const [title, setTitle] = useState(existing?.title ?? defaultTitle(kind, application));
  const [titleEdited, setTitleEdited] = useState(Boolean(existing));
  const [day, setDay] = useState(start?.day ?? (target.mode === "create" ? target.day : undefined) ?? "");
  const [time, setTime] = useState(start?.time ?? "10:00");
  const [duration, setDuration] = useState(existing ? durationMinutes(existing) : 60);
  const [location, setLocation] = useState(existing?.location ?? "");
  const [videoUrl, setVideoUrl] = useState(existing?.video_url ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [advance, setAdvance] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Le titre suit le type et la candidature tant qu'il n'a pas été modifié à la main.
  useEffect(() => {
    if (!titleEdited) setTitle(defaultTitle(kind, application));
  }, [kind, application, titleEdited]);

  const willAdvance = !existing && application && FORWARD[kind]?.includes(application.status);
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const startsAt = localToIso(day, time);
    const input = {
      kind,
      title: title.trim(),
      starts_at: startsAt,
      ends_at: new Date(new Date(startsAt).getTime() + duration * 60000).toISOString(),
      location: location.trim(),
      video_url: videoUrl.trim(),
      notes,
      application_id: applicationId || null,
    };
    try {
      onSaved(existing ? await updateEvent(existing.id, input) : await createEvent({ ...input, advance_status: advance }));
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    try {
      await deleteEvent(existing.id);
      onDeleted(existing.id);
    } catch (e) {
      setError(e as ApiError);
      setConfirming(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <h2 className="text-[20px] font-semibold tracking-tight">{existing ? "Modifier l'événement" : "Nouvel événement"}</h2>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Fermer" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </header>

      <SegmentedControl
        label="Type d'événement"
        segments={kindOrder.map((value) => ({ value, label: eventKinds[value].label }))}
        value={kind}
        onChange={setKind}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-application" className="text-[13px] font-medium">
          Candidature
        </label>
        <select
          id="event-application"
          className={selectClass}
          value={applicationId}
          onChange={(event) => setApplicationId(event.target.value)}
        >
          <option value="">Aucune</option>
          {applications.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
              {item.company ? ` · ${item.company}` : ""} ({applicationStatuses[item.status].label})
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Titre"
        required
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setTitleEdited(true);
        }}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_128px_112px] gap-3">
        <Input label="Date" type="date" required value={day} onChange={(event) => setDay(event.target.value)} />
        <Input label="Heure" type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="event-duration" className="text-[13px] font-medium">
            Durée
          </label>
          <select
            id="event-duration"
            className={selectClass}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          >
            {durations.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ""}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Input label="Lieu" placeholder="Adresse, ou « Visio »" value={location} onChange={(event) => setLocation(event.target.value)} />
      <Input
        label="Lien de visio"
        type="url"
        placeholder="https://meet.google.com/..."
        value={videoUrl}
        onChange={(event) => setVideoUrl(event.target.value)}
      />
      <Textarea
        label="Notes"
        rows={4}
        placeholder="Interlocuteurs, points à préparer..."
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      {willAdvance && (
        <div className="rounded-[12px] border border-border bg-background-subtle px-4 py-3">
          <Switch
            checked={advance}
            onChange={setAdvance}
            label={`Passer la candidature à « ${eventKinds[kind].label} »`}
            description={`Aujourd'hui : ${applicationStatuses[application.status].label}`}
          />
        </div>
      )}

      {error && <ErrorBanner error={error} />}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="submit" loading={busy} disabled={!day || !title.trim()}>
          {existing ? "Enregistrer" : "Ajouter au calendrier"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        {existing &&
          (confirming ? (
            <span className="ml-auto flex items-center gap-2" role="alertdialog" aria-label="Confirmer la suppression">
              <span className="text-[13px] text-text-secondary">Supprimer ?</span>
              <Button type="button" variant="danger" size="sm" onClick={remove}>
                Supprimer
              </Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="ml-auto hover:text-danger" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden />
              Supprimer
            </Button>
          ))}
      </div>
    </form>
  );
}
