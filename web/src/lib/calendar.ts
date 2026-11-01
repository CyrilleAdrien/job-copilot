import { CalendarCheck, CalendarDays, ClipboardCheck, Repeat, type LucideIcon } from "lucide-react";

import { parseError } from "@/lib/api";
import type { Tone } from "@/lib/statuses";

const BASE = "/api/calendar";

export type EventKind = "interview" | "technical_test" | "follow_up" | "other";

/** Même icône et même couleur que le statut de candidature correspondant. */
export const eventKinds: Record<EventKind, { label: string; tone: Tone; icon: LucideIcon }> = {
  interview: { label: "Entretien", tone: "ai", icon: CalendarCheck },
  technical_test: { label: "Test technique", tone: "ai", icon: ClipboardCheck },
  follow_up: { label: "Relance", tone: "warning", icon: Repeat },
  other: { label: "Rendez-vous", tone: "neutral", icon: CalendarDays },
};
export const kindOrder = Object.keys(eventKinds) as EventKind[];

export type CalendarEvent = {
  id: string;
  application_id: string | null;
  kind: EventKind;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  video_url: string;
  notes: string;
  synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
  status_changed?: boolean;
};

export type EventInput = {
  kind: EventKind;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  video_url: string;
  notes: string;
  application_id: string | null;
};

export type CalendarProvider = {
  id: string;
  label: string;
  url: string;
  help: string;
  steps: string[];
  links: { label: string; url: string }[];
  caldav: boolean;
};

export type RemoteCalendar = { url: string; name: string };

export type CalendarAccount = {
  id: string;
  provider: string;
  url: string;
  username: string;
  calendar_name: string;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
};

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseError(response);
  return response.json();
}

const send = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export async function fetchEvents(params: { from?: string; to?: string; application_id?: string; limit?: number } = {}) {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
  return json<CalendarEvent[]>(await fetch(`${BASE}/events${query ? `?${query}` : ""}`, { cache: "no-store" }));
}

export const createEvent = async (input: EventInput & { advance_status: boolean }) =>
  json<CalendarEvent>(await fetch(`${BASE}/events`, send("POST", input)));

export const updateEvent = async (id: string, changes: Partial<EventInput>) =>
  json<CalendarEvent>(await fetch(`${BASE}/events/${id}`, send("PATCH", changes)));

export async function deleteEvent(id: string): Promise<void> {
  const response = await fetch(`${BASE}/events/${id}`, { method: "DELETE" });
  if (!response.ok) throw await parseError(response);
}

export const fetchCalendarProviders = async () => json<CalendarProvider[]>(await fetch(`${BASE}/providers`));
export const fetchCalendarAccounts = async () =>
  json<CalendarAccount[]>(await fetch(`${BASE}/accounts`, { cache: "no-store" }));
export const discoverCalendars = async (credentials: { provider: string; url: string; username: string; password: string }) =>
  json<RemoteCalendar[]>(await fetch(`${BASE}/accounts/discover`, send("POST", credentials)));
export const connectCalendar = async (
  account: { provider: string; url: string; username: string; password: string; calendar_url: string; calendar_name: string },
) => json<CalendarAccount>(await fetch(`${BASE}/accounts`, send("POST", account)));

export async function disconnectCalendar(id: string): Promise<void> {
  const response = await fetch(`${BASE}/accounts/${id}`, { method: "DELETE" });
  if (!response.ok) throw await parseError(response);
}

export const syncCalendar = async () =>
  json<{ pushed: number; errors: string[] }>(await fetch(`${BASE}/sync`, { method: "POST" }));

export const eventIcsUrl = (id: string) => `${BASE}/events/${id}/ics`;
export const feedDownloadUrl = `${BASE}/feed.ics?download=true`;

/** Adresse d'abonnement (webcal://) pour Calendrier sur Mac ou Thunderbird, depuis l'origine de l'app. */
export function feedUrl(origin: string) {
  return `${origin.replace(/^https?:/, "webcal:")}${BASE}/feed.ics`;
}

const compact = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Lien « Ajouter à Google Agenda » : Google ouvre l'événement prérempli, sans connexion à l'app. */
export function googleCalendarUrl(event: Pick<CalendarEvent, "title" | "starts_at" | "ends_at" | "location" | "video_url" | "notes">) {
  const details = [event.notes.trim(), event.video_url && `Visio : ${event.video_url}`].filter(Boolean).join("\n\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${compact(event.starts_at)}/${compact(event.ends_at)}`,
  });
  if (details) params.set("details", details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Titre proposé : « Entretien · Nimbus Data ». */
export function defaultTitle(kind: EventKind, application?: { title: string; company: string | null }) {
  const label = eventKinds[kind].label;
  if (!application) return label;
  return `${label} · ${application.company ?? application.title}`;
}

/** Clé locale d'un jour : 2026-11-04. */
export function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Les 6 semaines affichées pour un mois, du lundi au dimanche. */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + index));
}

export function eventsByDay(events: CalendarEvent[]) {
  const days = new Map<string, CalendarEvent[]>();
  for (const event of [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const key = dayKey(new Date(event.starts_at));
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return days;
}

/** Date et heure saisies (heure locale) vers ISO 8601 avec fuseau. */
export function localToIso(day: string, time: string) {
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, date, hours, minutes).toISOString();
}

/** ISO vers les champs du formulaire (heure locale). */
export function isoToLocal(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { day: dayKey(date), time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}

export function durationMinutes(event: Pick<CalendarEvent, "starts_at" | "ends_at">) {
  return Math.round((new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000);
}

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** « mardi 4 novembre · 14:00 – 15:00 ». */
export function formatSlot(event: Pick<CalendarEvent, "starts_at" | "ends_at">) {
  const start = new Date(event.starts_at);
  return `${dayFormat.format(start)} · ${timeFormat.format(start)} – ${timeFormat.format(new Date(event.ends_at))}`;
}

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** « aujourd'hui », « demain », « dans 5 j », ou null quand c'est passé. */
export function countdown(iso: string, now: Date = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(iso);
  const day = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const days = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (target.getTime() < now.getTime()) return null;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days} j`;
}
