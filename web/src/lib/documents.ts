import { parseError } from "@/lib/api";

export type Language = "fr" | "en";
export type DocumentKind = "cv" | "letter";

export type GenerationStep = {
  key: string;
  label: string;
  state: "pending" | "running" | "done" | "error";
};

export type DocumentInfo = {
  id: string;
  kind: DocumentKind;
  language: Language;
  version: number;
  pages: number;
  created_at: string;
};

export type GenerationWarning = { kind: DocumentKind; text: string; reason: string };

export type Generation = {
  id: string;
  offer_id: number;
  offer_title: string | null;
  company: string | null;
  language: Language | null;
  status: "running" | "done" | "error";
  steps: GenerationStep[];
  error: string | null;
  warnings: GenerationWarning[];
  documents: DocumentInfo[];
  created_at: string;
};

export type LetterContent = {
  language: Language;
  sender: string[];
  recipient: string[];
  place_date: string;
  subject: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
  signature: string;
};

export type LLMStatus = { provider: string; model: string; ready: boolean };

const BASE = "/api/documents";

export const kindLabels: Record<DocumentKind, string> = { cv: "CV", letter: "Lettre" };

export function pdfUrl(document: DocumentInfo) {
  // La version dans l'URL force le rechargement de l'aperçu après une modification.
  return `${BASE}/documents/${document.id}/pdf?v=${document.version}`;
}

export function pageUrl(document: DocumentInfo, page: number) {
  return `${BASE}/documents/${document.id}/pages/${page}?v=${document.version}`;
}

export function eventsUrl(generationId: string) {
  return `${BASE}/generations/${generationId}/events`;
}

/** Index de l'étape en cours, au sens du composant StepProgress (longueur = terminé). */
export function currentStep(generation: Generation) {
  const index = generation.steps.findIndex((step) => step.state !== "done");
  return index === -1 ? generation.steps.length : index;
}

export function paragraphsToText(paragraphs: string[]) {
  return paragraphs.join("\n\n");
}

export function textToParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function fetchGenerations(offerId: number): Promise<Generation[]> {
  return json(await fetch(`${BASE}/generations?offer_id=${offerId}&limit=1`, { cache: "no-store" }));
}

export async function startGeneration(
  offerId: number,
  options: { letter: boolean; language: Language | null; search?: string },
): Promise<Generation> {
  return json(
    await fetch(`${BASE}/generations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offer_id: offerId, ...options }),
    }),
  );
}

export async function fetchGeneration(id: string): Promise<Generation> {
  return json(await fetch(`${BASE}/generations/${id}`, { cache: "no-store" }));
}

export async function fetchLetter(id: string): Promise<LetterContent> {
  const document = await json<{ content: LetterContent }>(
    await fetch(`${BASE}/documents/${id}`, { cache: "no-store" }),
  );
  return document.content;
}

export async function saveLetter(id: string, content: LetterContent): Promise<DocumentInfo> {
  return json(
    await fetch(`${BASE}/documents/${id}/content`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(content),
    }),
  );
}

export async function fetchLLMStatus(): Promise<LLMStatus> {
  return json(await fetch(`${BASE}/llm`, { cache: "no-store" }));
}

/** Le profil entier mis en page comme un CV, sans LLM. `stamp` force un nouveau rendu. */
export async function fetchProfilePreview(language: Language): Promise<{ pages: number }> {
  return json(await fetch(`${BASE}/profile-preview?language=${language}`, { cache: "no-store" }));
}

export const profilePreviewPageUrl = (language: Language, page: number, stamp: number) =>
  `${BASE}/profile-preview/pages/${page}?language=${language}&v=${stamp}`;

export const profilePreviewPdfUrl = (language: Language) => `${BASE}/profile-preview/pdf?language=${language}`;
