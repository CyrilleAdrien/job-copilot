import { parseError } from "@/lib/api";

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseError(response);
  return response.json();
}

const send = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export type ServiceState = { service: string; status: string; checks?: Record<string, string>; error?: string };
export type SystemStatus = { status: "ok" | "degraded"; services: Record<string, ServiceState> };

export type LlmState = {
  provider: string;
  url: string;
  model: string;
  default_model: string;
  reachable: boolean;
  model_installed: boolean;
  installed: { name: string; size: number }[];
};

export type SourceInfo = { name: string; label: string; configured: boolean; origin: "settings" | "env" | null };
export type SearchSettings = { refresh_minutes: number; encryption: boolean };

export const fetchSystemStatus = async (): Promise<SystemStatus> => json(await fetch("/api/system/status", { cache: "no-store" }));
export const fetchLlm = async (): Promise<LlmState> => json(await fetch("/api/system/llm", { cache: "no-store" }));
export const chooseModel = async (model: string): Promise<LlmState> => json(await fetch("/api/system/llm", send("PUT", { model })));
export const testLlm = async (): Promise<{ model: string; seconds: number }> => json(await fetch("/api/system/llm/test", { method: "POST" }));

export const fetchSources = async (): Promise<SourceInfo[]> => json(await fetch("/api/jobs/sources", { cache: "no-store" }));
export const saveSourceKeys = async (name: string, keys: { key_id: string; secret: string }): Promise<SourceInfo> =>
  json(await fetch(`/api/jobs/sources/${name}`, send("PUT", keys)));
export const testSource = async (name: string): Promise<SourceInfo> => json(await fetch(`/api/jobs/sources/${name}/test`, { method: "POST" }));
export async function removeSourceKeys(name: string): Promise<void> {
  const response = await fetch(`/api/jobs/sources/${name}`, { method: "DELETE" });
  if (!response.ok) throw await parseError(response);
}
export const fetchSearchSettings = async (): Promise<SearchSettings> => json(await fetch("/api/jobs/search-settings", { cache: "no-store" }));
export const saveSearchSettings = async (refresh_minutes: number): Promise<SearchSettings> =>
  json(await fetch("/api/jobs/search-settings", send("PUT", { refresh_minutes })));

/** Le modèle a sa propre étape : Ollama arrêté ne compte pas comme une panne de service. */
export function serviceWorks(state: ServiceState | undefined): boolean {
  if (!state) return false;
  if (!state.checks) return state.status === "ok";
  return Object.entries(state.checks).every(([name, result]) => name === "ollama" || result === "ok");
}

export function brokenServices(status: SystemStatus): string[] {
  return Object.entries(status.services)
    .filter(([, state]) => !serviceWorks(state))
    .map(([name]) => name);
}

/** Les dépendances communes (base, Redis, stockage, Ollama) et leur état : une seule panne suffit. */
export function dependencyStates(status: SystemStatus): Record<string, boolean> {
  const states: Record<string, boolean> = {};
  for (const service of Object.values(status.services)) {
    for (const [name, result] of Object.entries(service.checks ?? {})) {
      states[name] = (states[name] ?? true) && result === "ok";
    }
  }
  return states;
}

export type StepId = "systeme" | "modele" | "profil" | "sources" | "boite-mail" | "calendrier" | "donnees";
export type StepState = "ready" | "todo" | "error" | "locked" | "optional";
export type Step = { id: StepId; title: string; state: StepState; summary: string };

export type SettingsData = {
  /** null : la donnée n'a pas pu être lue. */
  status: SystemStatus | null;
  llm: LlmState | null;
  profile: { name: string; searches: number } | null;
  profileLoaded: boolean;
  sources: SourceInfo[] | null;
  mail: { email: string; last_error: string | null; smtp_error: string | null }[] | null;
  calendar: { last_error: string | null; calendar_name?: string | null }[] | null;
};

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** Les étapes dans l'ordre des dépendances. Une étape verrouillée dit ce qui manque avant elle. */
export function buildSteps({ status, llm, profile, profileLoaded, sources, mail, calendar }: SettingsData): Step[] {
  const broken = status ? brokenServices(status) : [];
  const down = (service: string) => status === null || broken.includes(service);

  const system: Step = {
    id: "systeme",
    title: "Système",
    state: status === null || broken.length > 0 ? "error" : "ready",
    summary: status === null ? "État illisible : la passerelle ne répond pas." : broken.length ? `En panne : ${broken.join(", ")}.` : "Tous les services répondent.",
  };

  const model: Step = {
    id: "modele",
    title: "Modèle IA",
    ...(llm === null
      ? { state: "error", summary: "État du modèle illisible." }
      : llm.provider === "demo"
        ? { state: "ready", summary: "Mode démonstration, sans modèle." }
        : !llm.reachable
          ? { state: "error", summary: "Ollama ne répond pas." }
          : !llm.model_installed
            ? { state: "error", summary: `${llm.model} n'est pas installé.` }
            : { state: "ready", summary: llm.model }),
  };

  const profileStep: Step = {
    id: "profil",
    title: "Profil",
    ...(down("profile")
      ? { state: "locked", summary: "Le service profil doit répondre." }
      : !profileLoaded
        ? { state: "error", summary: "Profil illisible." }
        : profile
          ? { state: "ready", summary: `${profile.name}, ${plural(profile.searches, "recherche")}.` }
          : { state: "todo", summary: "À remplir : tes offres et tes CV en dépendent." }),
  };

  const configured = sources?.filter((source) => source.configured) ?? [];
  const sourcesStep: Step = {
    id: "sources",
    title: "Sources d'offres",
    ...(down("jobs")
      ? { state: "locked", summary: "Le service des offres doit répondre." }
      : !profile
        ? { state: "locked", summary: "Remplis d'abord ton profil : il donne les critères de recherche." }
        : sources === null
          ? { state: "error", summary: "Sources illisibles." }
          : configured.length
            ? { state: "ready", summary: configured.map((source) => source.label).join(", ") }
            : { state: "todo", summary: "Ajoute au moins une source pour recevoir des offres." }),
  };

  const failing = mail?.filter((account) => account.last_error || account.smtp_error) ?? [];
  const mailStep: Step = {
    id: "boite-mail",
    title: "Boîte mail",
    ...(down("mail")
      ? { state: "locked", summary: "Le service mail doit répondre." }
      : mail === null
        ? { state: "error", summary: "Boîtes illisibles." }
        : failing.length
          ? { state: "error", summary: `À corriger : ${failing.map((account) => account.email).join(", ")}.` }
          : mail.length
            ? { state: "ready", summary: mail.map((account) => account.email).join(", ") }
            : { state: "todo", summary: "Connecte une boîte pour suivre les réponses des recruteurs." }),
  };

  const calendarStep: Step = {
    id: "calendrier",
    title: "Calendrier",
    ...(down("calendar")
      ? { state: "locked", summary: "Le service calendrier doit répondre." }
      : calendar === null
        ? { state: "error", summary: "Calendrier illisible." }
        : calendar.some((account) => account.last_error)
          ? { state: "error", summary: "La dernière synchronisation a échoué." }
          : calendar.length
            ? { state: "ready", summary: calendar[0].calendar_name ?? "Connecté." }
            : { state: "optional", summary: "Facultatif : recopie tes entretiens dans ton calendrier." }),
  };

  const data: Step = { id: "donnees", title: "Mes données", state: "optional", summary: "Exporter ou tout supprimer." };

  return [system, model, profileStep, sourcesStep, mailStep, calendarStep, data];
}

/** L'étape à ouvrir : celle demandée par le lien, sinon la première qui attend quelque chose. */
export function firstOpenStep(steps: Step[], hash: string): StepId {
  const requested = steps.find((step) => step.id === hash && step.state !== "locked");
  if (requested) return requested.id;
  return (steps.find((step) => step.state === "error" || step.state === "todo") ?? steps[0]).id;
}
