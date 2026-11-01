"use client";

import { AlertCircle, ArrowUpRight, CalendarPlus, Download, MapPin, Video } from "lucide-react";
import Link from "next/link";

import { toneBar, toneText } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApplicationSummary } from "@/lib/applications";
import { countdown, eventIcsUrl, eventKinds, formatSlot, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";
import { cn } from "@/lib/utils";

/** Un événement : type, titre, créneau, lieu, candidature liée, et ses exports. */
export function EventItem({
  event,
  application,
  onOpen,
  href,
  compact = false,
  now = new Date(),
}: {
  event: CalendarEvent;
  application?: ApplicationSummary;
  onOpen?: () => void;
  /** Le titre devient un lien (vers le calendrier, par exemple). */
  href?: string;
  /** Sans les boutons d'export : tableau de bord et fiche de candidature. */
  compact?: boolean;
  now?: Date;
}) {
  const { label, tone, icon: Icon } = eventKinds[event.kind];
  const soon = countdown(event.starts_at, now);
  return (
    <div className="relative flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface py-3 pl-4 pr-3">
      <span className={cn("absolute -left-px inset-y-[-1px] w-[3px] rounded-l-[10px]", toneBar[tone])} aria-hidden />
      <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
        <Icon className={cn("size-3.5", toneText[tone])} aria-hidden />
        <span>{label}</span>
        {soon && <span className="ml-auto font-medium text-text-secondary">{soon}</span>}
      </div>
      {href ? (
        <Link href={href} className="text-[13px] font-semibold leading-snug hover:text-accent-strong">
          {event.title}
        </Link>
      ) : onOpen ? (
        <button type="button" onClick={onOpen} className="text-left text-[13px] font-semibold leading-snug hover:text-accent-strong">
          {event.title}
        </button>
      ) : (
        <span className="text-[13px] font-semibold leading-snug">{event.title}</span>
      )}
      <span className="text-[12px] text-text-secondary first-letter:uppercase">{formatSlot(event)}</span>
      {(event.location || event.video_url) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-secondary">
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {event.location}
            </span>
          )}
          {event.video_url && (
            <a
              href={event.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent-strong hover:underline"
            >
              <Video className="size-3.5" aria-hidden />
              Rejoindre la visio
            </a>
          )}
        </div>
      )}
      {application && (
        <Link
          href={`/candidatures?id=${application.id}`}
          className="inline-flex w-fit items-center gap-1 text-[12px] text-accent-strong hover:underline"
        >
          {application.title}
          {application.company ? ` · ${application.company}` : ""}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      )}
      {event.sync_error && (
        <span className="flex items-start gap-1 text-[12px] text-danger">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Non recopié dans le calendrier connecté : {event.sync_error}
        </span>
      )}
      {!compact && (
        <div className="flex flex-wrap gap-1 pt-1">
          <Button variant="ghost" size="sm" asChild>
            <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
              <CalendarPlus aria-hidden />
              Google Agenda
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={eventIcsUrl(event.id)} download>
              <Download aria-hidden />
              Fichier .ics
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
