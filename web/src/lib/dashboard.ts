import { parseError } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/statuses";

export type WeekCount = { week: string; sent: number };

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
  total: number;
  sent: number;
  by_status: Record<ApplicationStatus, number>;
  responded: number;
  response_rate: number | null;
  average_response_days: number | null;
  weekly: WeekCount[];
  follow_ups: FollowUp[];
  follow_up_days: number;
  by_search: SearchOutcome[];
  best_search: string | null;
  min_sample: number;
  computed_at: string;
};

export async function fetchStats(): Promise<Stats> {
  const response = await fetch("/api/applications/stats", { cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

const short = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** « 26 oct. » : le lundi qui ouvre la semaine. */
export function weekLabel(week: string) {
  return short.format(new Date(`${week}T00:00:00`)).replace(".", "");
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
