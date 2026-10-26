import { ApiError, parseError } from "@/lib/api";

export type Contract = "cdi" | "cdd" | "freelance" | "alternance" | "stage" | "interim";
export type SortOrder = "date" | "relevance";
export type Window = 1 | 3 | 7 | 14 | 30;

export type Offer = {
  id: number;
  source: string;
  title: string;
  company: string | null;
  location: string | null;
  contract: Contract | null;
  salary: string | null;
  url: string;
  published_at: string;
  snippet: string;
  score: number;
  matched: string[];
  remote: "remote" | "hybrid" | null;
};

export type OfferDetail = Offer & { description: string };

export type OfferList = {
  items: Offer[];
  total: number;
  sort: SortOrder;
  max_age_days: Window;
  refreshed_at: string | null;
};

export type SourceStatus = {
  name: string;
  label: string;
  status: "ok" | "error" | "disabled";
  count: number;
  error: string | null;
};

export type RefreshResult = {
  refreshed_at: string;
  cached: boolean;
  fetched: number;
  stored: number;
  duplicates: number;
  sources: SourceStatus[];
};

export const windows: { value: `${Window}`; label: string }[] = [
  { value: "1", label: "24 h" },
  { value: "3", label: "3 j" },
  { value: "7", label: "7 j" },
  { value: "14", label: "14 j" },
  { value: "30", label: "30 j" },
];

export const sortOrders: { value: SortOrder; label: string }[] = [
  { value: "date", label: "Plus récentes" },
  { value: "relevance", label: "Pertinence" },
];

export const contractLabels: Record<Contract, string> = {
  cdi: "CDI",
  cdd: "CDD",
  freelance: "Freelance",
  alternance: "Alternance",
  stage: "Stage",
  interim: "Intérim",
};

export const sourceLabels: Record<string, string> = {
  france_travail: "France Travail",
  adzuna: "Adzuna",
  demo: "Démonstration",
};

/** « à l'instant », « il y a 3 h », « hier », « il y a 4 j ». */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
}

/** Les offres de moins de 24 h sont signalées comme nouvelles. */
export function isFresh(iso: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(iso).getTime() < 24 * 3600 * 1000;
}

export async function fetchOffers(sort: SortOrder, days?: Window): Promise<OfferList> {
  const params = new URLSearchParams({ sort, limit: "100" });
  if (days) params.set("max_age_days", String(days));
  const response = await fetch(`/api/jobs/offers?${params}`, { cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function fetchOffer(id: number): Promise<OfferDetail> {
  const response = await fetch(`/api/jobs/offers/${id}`, { cache: "no-store" });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function refreshOffers(days: Window, force = false): Promise<RefreshResult> {
  const params = new URLSearchParams({ max_age_days: String(days) });
  if (force) params.set("force", "true");
  const response = await fetch(`/api/jobs/refresh?${params}`, { method: "POST" });
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export { ApiError };
