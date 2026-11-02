import { parseError } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/statuses";

export type FollowUp = {
  id: string;
  title: string;
  company: string | null;
  status: ApplicationStatus;
  contact_email: string | null;
  since: string;
  days: number;
};

export type SearchOutcome = {
  /** null : candidatures ajoutées à la main. */
  search_id: string | null;
  sent: number;
  responded: number;
  technical_tests: number;
  interviews: number;
  offers: number;
  rejected: number;
  response_rate: number | null;
  progress_rate: number | null;
};

export type Stats = {
  /** Toutes les candidatures, quels que soient les filtres. */
  all_total: number;
  /** Candidatures de la période. */
  total: number;
  sent: number;
  by_status: Record<ApplicationStatus, number>;
  responded: number;
  response_rate: number | null;
  average_response_days: number | null;
  sent_dates: string[];
  follow_ups: FollowUp[];
  follow_up_days: number;
  by_search: SearchOutcome[];
  best_search: string | null;
  min_sample: number;
  computed_at: string;
};

export type Granularity = "all" | "year" | "month" | "week" | "day";

/** Début (inclus) et fin (exclue) de la période contenant `anchor`, en heure locale. */
export function periodBounds(granularity: Granularity, anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();
  if (granularity === "all") return null;
  if (granularity === "year") return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  if (granularity === "month") return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) };
  if (granularity === "day") return { from: new Date(year, month, day), to: new Date(year, month, day + 1) };
  const monday = day - ((anchor.getDay() + 6) % 7);
  return { from: new Date(year, month, monday), to: new Date(year, month, monday + 7) };
}

/** Le même moment, une période plus tôt ou plus tard. Le jour 1 évite de sauter un mois court. */
export function shiftPeriod(granularity: Granularity, anchor: Date, step: -1 | 1) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();
  if (granularity === "year") return new Date(year + step, 0, 1);
  if (granularity === "month") return new Date(year, month + step, 1);
  if (granularity === "week") return new Date(year, month, day + step * 7);
  if (granularity === "day") return new Date(year, month, day + step);
  return anchor;
}

const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const fullDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const monthYear = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const shortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const clean = (text: string) => text.replace(".", "");

/** Le nom de la période affichée : « novembre 2026 », « 2 – 8 nov ». */
export function periodLabel(granularity: Granularity, anchor: Date) {
  const bounds = periodBounds(granularity, anchor);
  if (!bounds) return "Depuis le début";
  if (granularity === "year") return String(anchor.getFullYear());
  if (granularity === "month") return monthYear.format(anchor);
  if (granularity === "day") return fullDay.format(anchor);
  const last = new Date(bounds.to.getFullYear(), bounds.to.getMonth(), bounds.to.getDate() - 1);
  return `${clean(dayMonth.format(bounds.from))} – ${clean(dayMonth.format(last))}`;
}

export type ChartBar = { key: string; label: string; detail: string; value: number };

/** Les envois regroupés selon la période, en heure locale : tout depuis 12 semaines, ou chaque unité de la période. */
export function sentBars(granularity: Granularity, anchor: Date, dates: string[], now: Date = new Date()): ChartBar[] {
  const moments = dates.map((date) => new Date(date));
  const count = (from: Date, to: Date) => moments.filter((moment) => moment >= from && moment < to).length;
  const bounds = periodBounds(granularity, anchor);

  if (!bounds) {
    const thisWeek = periodBounds("week", now)!.from;
    return Array.from({ length: 12 }, (_, index) => {
      const from = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() - (11 - index) * 7);
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
      const label = clean(dayMonth.format(from));
      return { key: from.toISOString(), label, detail: `Semaine du ${label}`, value: count(from, to) };
    });
  }
  if (granularity === "year") {
    return Array.from({ length: 12 }, (_, month) => {
      const from = new Date(anchor.getFullYear(), month, 1);
      return { key: from.toISOString(), label: clean(shortMonth.format(from)), detail: monthYear.format(from), value: count(from, new Date(anchor.getFullYear(), month + 1, 1)) };
    });
  }
  if (granularity === "day") {
    return Array.from({ length: 24 }, (_, hour) => {
      const from = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), hour);
      const to = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), hour + 1);
      return { key: from.toISOString(), label: `${hour} h`, detail: `De ${hour} h à ${hour + 1} h`, value: count(from, to) };
    });
  }
  const bars: ChartBar[] = [];
  for (let from = bounds.from; from < bounds.to; from = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)) {
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    const label = clean(dayMonth.format(from));
    bars.push({ key: from.toISOString(), label, detail: fullDay.format(from), value: count(from, to) });
  }
  return bars;
}

export const chartTitles: Record<Granularity, { title: string; description: string }> = {
  all: { title: "Envois par semaine", description: "Les 12 dernières semaines, d'après la date d'envoi." },
  year: { title: "Envois par mois", description: "Chaque mois de l'année, d'après la date d'envoi." },
  month: { title: "Envois par jour", description: "Chaque jour du mois, d'après la date d'envoi." },
  week: { title: "Envois par jour", description: "Chaque jour de la semaine, d'après la date d'envoi." },
  day: { title: "Envois par heure", description: "Chaque heure de la journée, d'après la date d'envoi." },
};

export type StatsFilters = { from?: Date; to?: Date; status?: ApplicationStatus | null };

export async function fetchStats(filters: StatsFilters = {}): Promise<Stats> {
  const params = new URLSearchParams();
  if (filters.from) params.set("date_from", filters.from.toISOString());
  if (filters.to) params.set("date_to", filters.to.toISOString());
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  const response = await fetch(`/api/applications/stats${query ? `?${query}` : ""}`, { cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

/** Ordre choisi pour que le vert et le rouge ne se touchent jamais, y compris pour un daltonien. */
export const STATUS_GROUPS: { id: string; label: string; statuses: ApplicationStatus[]; color: string }[] = [
  { id: "offer", label: "Offres", statuses: ["offer"], color: "var(--success)" },
  { id: "progress", label: "Tests et entretiens", statuses: ["technical_test", "interview"], color: "var(--accent)" },
  { id: "closed", label: "Refus et abandons", statuses: ["rejected", "withdrawn"], color: "var(--danger)" },
  { id: "waiting", label: "En attente", statuses: ["sent", "followed_up"], color: "var(--text)" },
  { id: "draft", label: "À envoyer", statuses: ["draft"], color: "var(--border-strong)" },
];

/** Compte de statuts soumis au filtre : un statut choisi efface les autres. */
export function focusedCount(byStatus: Stats["by_status"], statuses: ApplicationStatus[], focus: ApplicationStatus | null) {
  return statuses.filter((status) => !focus || status === focus).reduce((total, status) => total + byStatus[status], 0);
}

/** Graduations de l'axe vertical : 0, puis des pas entiers « ronds » jusqu'au maximum. */
export function ticks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

export function percent(rate: number | null) {
  return rate === null ? null : Math.round(rate * 100);
}

/** Phrase de synthèse : quel profil visé obtient le plus de tests ou d'entretiens. */
export function bestSearchSummary(stats: Pick<Stats, "by_search" | "best_search" | "min_sample">, names: Record<string, string>) {
  const name = (id: string | null) => (id === null ? "Ajoutées à la main" : (names[id] ?? id));
  const ranked = stats.by_search.filter((o) => o.search_id !== null);
  if (stats.best_search === null) {
    return ranked.some((o) => o.sent >= stats.min_sample)
      ? "Aucune recherche n'a encore mené à un test technique ou un entretien."
      : `Il faut au moins ${stats.min_sample} candidatures envoyées par recherche pour comparer.`;
  }
  const best = ranked.find((o) => o.search_id === stats.best_search)!;
  const others = ranked.filter((o) => o.search_id !== stats.best_search && o.sent >= stats.min_sample);
  const head = `${name(best.search_id)} obtient le plus de retours positifs : ${percent(best.progress_rate)} % de tests techniques ou d'entretiens`;
  if (others.length === 0) return `${head}.`;
  const next = others[0];
  return `${head}, contre ${percent(next.progress_rate)} % pour ${name(next.search_id)}.`;
}
