import { parseError } from "@/lib/api";
import type { CvContent } from "@/lib/cv-content";

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

export function wordUrl(document: DocumentInfo) {
  return `${BASE}/documents/${document.id}/docx?v=${document.version}`;
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

export async function fetchCv(id: string): Promise<CvContent> {
  const document = await json<{ content: CvContent }>(await fetch(`${BASE}/documents/${id}`, { cache: "no-store" }));
  return document.content;
}

export async function saveCv(id: string, content: CvContent): Promise<DocumentInfo> {
  return json(
    await fetch(`${BASE}/documents/${id}/content`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(content),
    }),
  );
}

/** Le rendu d'un contenu en cours de modification : rien n'est enregistré. */
export async function previewCv(id: string, content: CvContent): Promise<string[]> {
  const preview = await json<{ pages: string[] }>(
    await fetch(`${BASE}/documents/${id}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(content),
    }),
  );
  return preview.pages.map((page) => `data:image/svg+xml;base64,${page}`);
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

const previewQuery = (language: Language, search: string) =>
  `language=${language}&search=${encodeURIComponent(search)}`;

/** Le CV entier d'une recherche, mis en page sans LLM. `stamp` force un nouveau rendu. */
export async function fetchProfilePreview(language: Language, search: string): Promise<{ pages: number }> {
  return json(await fetch(`${BASE}/profile-preview?${previewQuery(language, search)}`, { cache: "no-store" }));
}

export const profilePreviewPageUrl = (language: Language, page: number, stamp: number, search: string) =>
  `${BASE}/profile-preview/pages/${page}?${previewQuery(language, search)}&v=${stamp}`;

export const profilePreviewPdfUrl = (language: Language, search: string) =>
  `${BASE}/profile-preview/pdf?${previewQuery(language, search)}`;
export const profilePreviewWordUrl = (language: Language, search: string) =>
  `${BASE}/profile-preview/docx?${previewQuery(language, search)}`;
