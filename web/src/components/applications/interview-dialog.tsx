"use client";

import { CalendarPlus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { ApiError } from "@/lib/api";
import { updateApplication, type Application, type ApplicationSummary } from "@/lib/applications";
import { createEvent, interviewEvent } from "@/lib/calendar";

const DURATIONS = [30, 45, 60, 90, 120];

export type InterviewSlot = { day: string; time: string; minutes: number };

/** Date, heure et durée d'un entretien, partagées par la fenêtre et le formulaire d'ajout. */
export function InterviewFields({ slot, onChange }: { slot: InterviewSlot; onChange: (slot: InterviewSlot) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Input label="Date de l'entretien" type="date" required value={slot.day} onChange={(event) => onChange({ ...slot, day: event.target.value })} />
      <Input label="Heure" type="time" required value={slot.time} onChange={(event) => onChange({ ...slot, time: event.target.value })} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="interview-duration" className="text-[13px] font-medium">
          Durée
        </label>
        <select
          id="interview-duration"
          value={slot.minutes}
          onChange={(event) => onChange({ ...slot, minutes: Number(event.target.value) })}
          className="h-11 w-full rounded-[12px] border border-border-strong bg-surface px-3 text-sm text-text transition-colors duration-150 focus:border-text focus:outline-none"
        >
          {DURATIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ""}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export const emptySlot: InterviewSlot = { day: "", time: "10:00", minutes: 60 };

/** S'ouvre au passage en Entretien. Fermer sans choisir laisse la candidature dans son statut. */
export function InterviewDialog({
  application,
  onClose,
  onChanged,
}: {
  application: ApplicationSummary | null;
  onClose: () => void;
  /** Le statut ou le calendrier ont changé. */
  onChanged: (updated: Application) => void;
}) {
  return (
    <Modal
      open={application !== null}
      onClose={onClose}
      title="Planifier l'entretien"
      description={application ? [application.title, application.company].filter(Boolean).join(" · ") : undefined}
    >
      {application && <InterviewForm key={application.id} application={application} onClose={onClose} onChanged={onChanged} />}
    </Modal>
  );
}

function InterviewForm({ application, onClose, onChanged }: { application: ApplicationSummary; onClose: () => void; onChanged: (updated: Application) => void }) {
  const [slot, setSlot] = useState(emptySlot);
  const [busy, setBusy] = useState<"schedule" | "skip" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // Le statut passe en premier : réessayer après un échec du calendrier ne le change pas deux fois.
  const [moved, setMoved] = useState(false);

  async function moveStatus() {
    if (moved) return;
    onChanged(await updateApplication(application.id, { status: "interview" }));
    setMoved(true);
  }

  async function run(action: "schedule" | "skip") {
    setBusy(action);
    setError(null);
    try {
      await moveStatus();
      if (action === "schedule") {
        await createEvent({ ...interviewEvent(application, slot.day, slot.time, slot.minutes), advance_status: false });
        onChanged({ ...application, status: "interview" } as Application);
      }
      onClose();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    run("schedule");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <InterviewFields slot={slot} onChange={setSlot} />
      <p className="text-[13px] text-text-secondary">L&apos;entretien sera ajouté au calendrier, et à ton calendrier connecté s&apos;il y en a un.</p>
      {moved && error && <p className="text-[13px] text-warning">La candidature est passée en Entretien, mais le rendez-vous n&apos;a pas été créé. Tu peux réessayer.</p>}
      {error && <ErrorBanner error={error} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy !== null} onClick={onClose}>
          {moved ? "Fermer" : "Annuler"}
        </Button>
        {!moved && (
          <Button type="button" variant="secondary" loading={busy === "skip"} disabled={busy !== null} onClick={() => run("skip")}>
            Sans date pour l&apos;instant
          </Button>
        )}
        <Button type="submit" loading={busy === "schedule"} disabled={busy !== null || !slot.day || !slot.time}>
          <CalendarPlus aria-hidden />
          Planifier
        </Button>
      </div>
    </form>
  );
}
