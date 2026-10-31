import { ApiError, parseError } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/statuses";

const BASE = "/api/applications/applications";

/** Ordre des colonnes du Kanban : le parcours habituel, puis les issues. */
export const statusOrder: ApplicationStatus[] = [
  "draft",
  "sent",
  "followed_up",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

export type StatusEvent = {
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  source: "manual" | "mail" | "system";
  created_at: string;
};

export type ApplicationSummary = {
  id: string;
  offer_id: number | null;
  search_id: string | null;
  title: string;
  company: string | null;
  location: string | null;
  url: string | null;
  source: string | null;
  contact_email: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  cv_document_id: string | null;
  letter_document_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Application = ApplicationSummary & {
  description: string | null;
  notes: string;
  events: StatusEvent[];
};

export type ApplicationDraft = {
  offer_id?: number;
  search?: string;
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  status?: ApplicationStatus;
};

export type ApplicationChanges = Partial<
  Pick<
    Application,
    | "status"
    | "title"
    | "company"
    | "location"
    | "url"
    | "contact_email"
    | "notes"
    | "cv_document_id"
    | "letter_document_id"
  >
>;

/** Identifiants de la dernière version du CV et de la lettre. */
export function latestDocumentIds(documents: { id: string; kind: "cv" | "letter"; version: number }[]) {
  const latest: { cv_document_id?: string; letter_document_id?: string } = {};
  for (const kind of ["cv", "letter"] as const) {
    const last = documents.filter((doc) => doc.kind === kind).sort((a, b) => b.version - a.version)[0];
    if (last) latest[kind === "cv" ? "cv_document_id" : "letter_document_id"] = last.id;
  }
  return latest;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function fetchApplications(offerId?: number): Promise<ApplicationSummary[]> {
  const query = offerId === undefined ? "" : `?offer_id=${offerId}`;
  return json(await fetch(`${BASE}${query}`, { cache: "no-store" }));
}

export async function fetchApplication(id: string): Promise<Application> {
  return json(await fetch(`${BASE}/${id}`, { cache: "no-store" }));
}

/** Crée la candidature (ou renvoie celle qui existe déjà pour l'offre). */
export async function createApplication(draft: ApplicationDraft): Promise<Application> {
  return json(
    await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }),
  );
}

export async function updateApplication(id: string, changes: ApplicationChanges): Promise<Application> {
  return json(
    await fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }),
  );
}

export async function deleteApplication(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!response.ok) throw await parseError(response);
}

export const documentPdfUrl = (id: string) => `/api/documents/documents/${id}/pdf`;

/** Brouillon de mail au recruteur. Les PDF sont à joindre à la main : un lien mailto ne le permet pas. */
export function mailtoUrl(application: Pick<ApplicationSummary, "contact_email" | "title">, signature: string) {
  const subject = `Candidature : ${application.title}`;
  const body = [
    "Bonjour,",
    "",
    `Je vous adresse ma candidature pour le poste de ${application.title}. Vous trouverez en pièces jointes mon CV et ma lettre de motivation.`,
    "",
    "Je reste à votre disposition pour un échange.",
    "",
    "Bien cordialement,",
    signature,
  ].join("\n");
  const params = new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20");
  return `mailto:${application.contact_email ?? ""}?${params}`;
}

/** Regroupe par statut, dans l'ordre du Kanban, les plus récentes d'abord. */
export function byStatus<T extends ApplicationSummary>(items: T[]): Record<ApplicationStatus, T[]> {
  const groups = Object.fromEntries(statusOrder.map((status) => [status, [] as T[]])) as Record<
    ApplicationStatus,
    T[]
  >;
  for (const item of [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
    groups[item.status].push(item);
  }
  return groups;
}

/** Au-delà, une candidature non envoyée est signalée. */
export const DRAFT_LATE_DAYS = 3;

/** Où en est une candidature « À envoyer » : documents prêts, et depuis combien de temps elle attend. */
export function draftReadiness(item: ApplicationSummary, now: Date = new Date()) {
  const cv = Boolean(item.cv_document_id);
  const letter = Boolean(item.letter_document_id);
  const waitingDays = (now.getTime() - new Date(item.created_at).getTime()) / (24 * 3600 * 1000);
  return { cv, letter, missing: !cv || !letter, late: waitingDays > DRAFT_LATE_DAYS };
}

export type Period = "all" | "7" | "30" | "90";

export type Filters = {
  query: string;
  statuses: ApplicationStatus[];
  /** Profil de recherche d'origine ; "manual" pour les candidatures ajoutées à la main. */
  search: string;
  period: Period;
  missingDocuments: boolean;
};

export const emptyFilters: Filters = { query: "", statuses: [], search: "all", period: "all", missingDocuments: false };

export function isFiltering(filters: Filters) {
  return (
    filters.query.trim() !== "" ||
    filters.statuses.length > 0 ||
    filters.search !== "all" ||
    filters.period !== "all" ||
    filters.missingDocuments
  );
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Filtres de l'écran Candidatures. La période porte sur la date d'envoi, ou de création à défaut. */
export function filterApplications<T extends ApplicationSummary>(items: T[], filters: Filters, now: Date = new Date()): T[] {
  const words = fold(filters.query).split(/\s+/).filter(Boolean);
  const since = filters.period === "all" ? null : now.getTime() - Number(filters.period) * 24 * 3600 * 1000;
  return items.filter((item) => {
    if (filters.statuses.length && !filters.statuses.includes(item.status)) return false;
    if (filters.search === "manual" ? item.source !== "manuel" : filters.search !== "all" && item.search_id !== filters.search)
      return false;
    if (since !== null && new Date(item.applied_at ?? item.created_at).getTime() < since) return false;
    if (filters.missingDocuments && item.cv_document_id && item.letter_document_id) return false;
    const haystack = fold([item.title, item.company, item.location].filter(Boolean).join(" "));
    return words.every((word) => haystack.includes(word));
  });
}

export { ApiError };
