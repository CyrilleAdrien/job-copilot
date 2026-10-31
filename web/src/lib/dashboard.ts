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
