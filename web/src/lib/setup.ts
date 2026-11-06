import { ApiError, fetchProfile, parseError } from "@/lib/api";
import { fetchCalendarAccounts, type CalendarAccount } from "@/lib/calendar";
import { fetchAccounts, type MailAccount } from "@/lib/mail";
import { buildSteps, fetchLlm, fetchSources, fetchSystemStatus, type SettingsData, type Step, type StepId } from "@/lib/system";

/** Mode choisi dans l'assistant : null tant qu'il n'a pas été terminé. */
export type Mode = "real" | "demo";
export type ModeState = { mode: Mode | null; forced_demo: boolean };

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseError(response);
  return response.json();
}

const send = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const fetchMode = async (): Promise<ModeState> => json(await fetch("/api/system/mode", { cache: "no-store" }));
export const chooseMode = async (mode: Mode): Promise<ModeState> => json(await fetch("/api/system/mode", send("PUT", { mode })));
export const startDemo = async (): Promise<ModeState> => json(await fetch("/api/system/demo", { method: "POST" }));

export type PullProgress = { status: string; total?: number; completed?: number };

/** Télécharge un modèle dans Ollama ; la progression arrive ligne par ligne. */
export async function pullModel(model: string, onProgress: (progress: PullProgress) => void): Promise<void> {
  const response = await fetch("/api/system/llm/pull", send("POST", { model }));
  if (!response.ok || !response.body) throw await parseError(response);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    buffer += decoder.decode(chunk.value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of done ? [...lines, buffer] : lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line) as PullProgress & { error?: string };
      if (message.error) throw new ApiError(`Téléchargement interrompu : ${message.error}`, 502);
      onProgress(message);
      if (message.status === "success") return;
    }
  }
  throw new ApiError("Téléchargement interrompu avant la fin. Relance-le : il reprend où il s'est arrêté.", 502);
}

export type SetupData = SettingsData & { mail: MailAccount[] | null; calendar: CalendarAccount[] | null; mode: ModeState | null };

/** Tout ce que l'assistant, le menu et l'aide doivent savoir. Une panne n'empêche pas de lire le reste. */
export async function loadSetup(): Promise<SetupData> {
  const value = <T,>(result: PromiseSettledResult<T>) => (result.status === "fulfilled" ? result.value : null);
  const [status, llm, profile, sources, mail, calendar, mode] = await Promise.allSettled([
    fetchSystemStatus(),
    fetchLlm(),
    fetchProfile(),
    fetchSources(),
    fetchAccounts(),
    fetchCalendarAccounts(),
    fetchMode(),
  ]);
  const person = value(profile);
  return {
    status: value(status),
    llm: value(llm),
    profile: person ? { name: person.identity.full_name, searches: person.searches.length } : null,
    profileLoaded: profile.status === "fulfilled",
    sources: value(sources),
    mail: value(mail),
    calendar: value(calendar),
    mode: value(mode),
  };
}

export const isDemo = (mode: ModeState | null) => mode?.mode === "demo" || mode?.forced_demo === true;

/** Étapes sans lesquelles l'outil ne sert à rien ; les autres débloquent chacune un écran. */
export const REQUIRED_STEPS: StepId[] = ["systeme", "modele", "profil"];

export const setupSteps = (data: SetupData): Step[] => buildSteps(data).filter((step) => step.id !== "donnees");

/**
 * L'assistant s'ouvre tant qu'aucun mode n'est choisi. Une installation d'avant l'assistant,
 * qui a déjà un profil, n'y est pas renvoyée : elle est considérée comme configurée.
 */
export function needsAssistant(data: SetupData): boolean {
  if (data.mode === null) return false;
  if (isDemo(data.mode) || data.mode.mode === "real") return false;
  return data.profileLoaded && data.profile === null;
}

export type Lock = { reason: string; step: StepId };

/** Ce qu'il manque pour ouvrir un écran, ou null s'il est accessible. */
export function lockFor(pathname: string, data: SetupData): Lock | null {
  if (isDemo(data.mode)) return null;
  const steps = new Map(setupSteps(data).map((step) => [step.id, step.state]));
  const needsProfile: Lock = { reason: "Remplis d'abord ton profil : cet écran en dépend.", step: "profil" };
  const screen = pathname.split("/")[1] ?? "";

  if (["", "candidatures", "calendrier", "offres"].includes(screen) && steps.get("profil") !== "ready") return needsProfile;
  if (screen === "offres" && steps.get("sources") !== "ready") {
    return { reason: "Ajoute au moins une source d'offres, France Travail ou Adzuna.", step: "sources" };
  }
  if (screen === "boite-de-reception" && !data.mail?.length) {
    return { reason: "Connecte une boîte mail pour suivre les réponses des recruteurs.", step: "boite-mail" };
  }
  return null;
}
