import {
  CalendarCheck,
  ClipboardCheck,
  HelpCircle,
  Inbox,
  Mail,
  Medal,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { parseError } from "@/lib/api";
import type { ApplicationStatus, Tone } from "@/lib/statuses";

const BASE = "/api/mail";

export type Category =
  | "rejection"
  | "technical_test"
  | "interview"
  | "offer"
  | "info_request"
  | "acknowledgment"
  | "other";

/** Même couleur que le statut que la catégorie entraîne ; neutre sinon. */
export const categories: Record<Category, { label: string; tone: Tone; icon: LucideIcon }> = {
  rejection: { label: "Refus", tone: "danger", icon: XCircle },
  technical_test: { label: "Test technique", tone: "ai", icon: ClipboardCheck },
  interview: { label: "Entretien", tone: "ai", icon: CalendarCheck },
  offer: { label: "Offre", tone: "success", icon: Medal },
  info_request: { label: "Demande d'infos", tone: "warning", icon: HelpCircle },
  acknowledgment: { label: "Accusé de réception", tone: "neutral", icon: Inbox },
  other: { label: "Autre", tone: "neutral", icon: Mail },
};
export const categoryOrder = Object.keys(categories) as Category[];

export type Provider = {
  id: string;
  label: string;
  host: string;
  port: number;
  help: string;
  /** Pas à pas pour créer le mot de passe d'application, et les pages à ouvrir. */
  steps: string[];
  links: { label: string; url: string }[];
};

export type MailAccount = {
  id: string;
  email: string;
  host: string;
  port: number;
  username: string;
  folder: string;
  /** Serveur d'envoi ; absent pour la boîte de démonstration. */
  smtp_host: string | null;
  smtp_port: number | null;
  /** Dernier test ou envoi. Vide : l'envoi n'a encore jamais été testé. */
  smtp_checked_at: string | null;
  smtp_error: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  messages: number;
};

export type MailReply = {
  id: string;
  account_id: string;
  /** Vide pour un nouveau message, sans mail d'origine. */
  message_id: string | null;
  to_address: string;
  subject: string;
  body: string;
  sent_at: string;
  /**
   * uncertain : la connexion a été coupée pendant la transmission, le mail est peut-être parti.
   * bounced : le serveur l'a accepté, puis un avis de non-distribution est arrivé.
   */
  status: "sending" | "sent" | "uncertain" | "bounced";
  error: string | null;
};

export type ReplyDraft = { to: string; subject: string; body: string };

export type MailMessage = {
  id: string;
  account_id: string;
  from_address: string;
  from_name: string | null;
  /** L'adresse de réponse demandée par le mail, si elle diffère de l'expéditeur. */
  reply_to: string | null;
  subject: string;
  received_at: string;
  snippet: string;
  category: Category;
  confidence: number;
  reason: string;
  application_id: string | null;
  match_reason: string | null;
  suggested_status: ApplicationStatus | null;
  status_applied: boolean;
  reviewed: boolean;
  replies: MailReply[];
};

export type SyncReport = { accounts: number; new: number; linked: number; applied: number; bounced: number; errors: string[] };

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await parseError(response);
  return response.json();
}

const send = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const fetchProviders = async (): Promise<Provider[]> => json(await fetch(`${BASE}/providers`));
export const fetchAccounts = async (): Promise<MailAccount[]> =>
  json(await fetch(`${BASE}/accounts`, { cache: "no-store" }));
export const addAccount = async (account: {
  email: string;
  host: string;
  port: number;
  password: string;
}): Promise<MailAccount> => json(await fetch(`${BASE}/accounts`, send("POST", account)));

export async function deleteAccount(id: string): Promise<void> {
  const response = await fetch(`${BASE}/accounts/${id}`, { method: "DELETE" });
  if (!response.ok) throw await parseError(response);
}

export const syncMail = async (): Promise<SyncReport> => json(await fetch(`${BASE}/sync`, { method: "POST" }));

export async function fetchMessages(params: { application_id?: string; review?: "pending" } = {}): Promise<MailMessage[]> {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return json(await fetch(`${BASE}/messages${query ? `?${query}` : ""}`, { cache: "no-store" }));
}

export const updateMessage = async (
  id: string,
  changes: Partial<Pick<MailMessage, "category" | "application_id" | "reviewed">>,
): Promise<MailMessage> => json(await fetch(`${BASE}/messages/${id}`, send("PATCH", changes)));

export const applyMessage = async (id: string): Promise<MailMessage> =>
  json(await fetch(`${BASE}/messages/${id}/apply`, { method: "POST" }));

/** `clientKey` reste le même pour un brouillon : un second clic ne renvoie pas le mail. */
export const sendReply = async (id: string, draft: ReplyDraft, clientKey: string): Promise<MailMessage> =>
  json(await fetch(`${BASE}/messages/${id}/reply`, send("POST", { ...draft, client_key: clientKey })));

export const sendNewMail = async (accountId: string, draft: ReplyDraft, clientKey: string): Promise<MailReply> =>
  json(await fetch(`${BASE}/accounts/${accountId}/send`, send("POST", { ...draft, client_key: clientKey })));

export const fetchSent = async (): Promise<MailReply[]> => json(await fetch(`${BASE}/sent`, { cache: "no-store" }));

/** Proposition d'Ollama pour une réponse. Rien n'est envoyé. `notes` : ce que l'utilisateur veut dire. */
export const draftReply = async (id: string, notes: string): Promise<string> => {
  const draft = await json<{ body: string }>(await fetch(`${BASE}/messages/${id}/draft`, send("POST", { notes })));
  return draft.body;
};

/** Ce que le modèle ne pouvait pas savoir : l'envoi reste bloqué tant que ce texte est là. */
export const TO_FILL = "[à compléter]";

/** Teste la connexion d'envoi, sans envoyer de mail. */
export const checkSending = async (accountId: string): Promise<MailAccount> =>
  json(await fetch(`${BASE}/accounts/${accountId}/smtp-check`, { method: "POST" }));

export const updateSmtpServer = async (accountId: string, server: { host: string; port: number }): Promise<MailAccount> =>
  json(await fetch(`${BASE}/accounts/${accountId}/smtp`, send("PUT", server)));

/** À qui répondre : l'adresse demandée par le mail, sinon son expéditeur. */
export const replyRecipient = (message: Pick<MailMessage, "reply_to" | "from_address">) =>
  message.reply_to ?? message.from_address;

const COMMON_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr", "live.com", "live.fr",
  "yahoo.com", "yahoo.fr", "icloud.com", "orange.fr", "wanadoo.fr", "free.fr", "laposte.net", "protonmail.com", "proton.me",
];
const WRONG_ENDING: Record<string, string> = { "gmail.fr": "gmail.com", "icloud.fr": "icloud.com" };

/** Une lettre en trop, en moins, remplacée, ou deux lettres voisines inversées. */
function oneTypoApart(a: string, b: string) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let start = 0;
  while (start < a.length && a[start] === b[start]) start += 1;
  if (a.length === b.length) {
    const swapped = a[start] === b[start + 1] && a[start + 1] === b[start];
    return a.slice(start + (swapped ? 2 : 1)) === b.slice(start + (swapped ? 2 : 1));
  }
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  return longer.slice(start + 1) === shorter.slice(start);
}

/** L'adresse corrigée si le domaine ressemble à une faute de frappe : `@gamil.com` pour `@gmail.com`. */
export function addressTypo(address: string): string | null {
  const [local, domain, ...rest] = address.trim().toLowerCase().split("@");
  if (!local || !domain || rest.length > 0 || COMMON_DOMAINS.includes(domain)) return null;
  const fixed = WRONG_ENDING[domain] ?? COMMON_DOMAINS.find((known) => oneTypoApart(domain, known));
  return fixed ? `${local}@${fixed}` : null;
}

/** Objet proposé pour une réponse : pas de second « Re: ». */
export function replySubject(subject: string) {
  const clean = subject.trim();
  if (!clean) return "Re: votre message";
  return (/^r[eé]\s*:/i.test(clean) ? clean : `Re: ${clean}`).slice(0, 500);
}

/** Mêmes règles que le service mail : une seule adresse, un objet, un message non vide. */
export function canSendReply({ to, subject, body }: ReplyDraft) {
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to.trim()) && subject.trim() !== "" && body.trim() !== "";
}

/** « À vérifier » : pas encore traité, à rattacher, ou statut suggéré mais pas appliqué. */
export function needsReview(message: MailMessage) {
  return !message.reviewed;
}

/** Résumé d'une lecture, en une phrase. */
export function syncSummary(report: SyncReport) {
  if (report.accounts === 0) return "Aucune boîte connectée.";
  const bounced = report.bounced ? `${report.bounced} mail${report.bounced > 1 ? "s" : ""} non distribué${report.bounced > 1 ? "s" : ""}` : null;
  if (report.new === 0) return bounced ? `${bounced}.` : "Aucun nouveau mail lié à tes candidatures.";
  const parts = [`${report.new} nouveau${report.new > 1 ? "x" : ""} mail${report.new > 1 ? "s" : ""}`];
  if (bounced) parts.push(bounced);
  if (report.applied) parts.push(`${report.applied} statut${report.applied > 1 ? "s" : ""} mis à jour`);
  return `${parts.join(", ")}.`;
}

export type InboxView = "inbox" | "pending" | "treated";
export type MailFolder = InboxView | "sent";

/** Mails d'un dossier, puis de la catégorie choisie. Les plus récents d'abord. */
export function filterMessages(messages: MailMessage[], view: InboxView, category: Category | "all") {
  return messages
    .filter((message) => view === "inbox" || (view === "pending") === needsReview(message))
    .filter((message) => category === "all" || message.category === category)
    .sort((a, b) => b.received_at.localeCompare(a.received_at));
}

const timeOnly = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Date courte de la liste : l'heure aujourd'hui, le jour cette année, la date complète avant. */
export function listDate(value: string, now: Date = new Date()) {
  const date = new Date(value);
  if (date.toDateString() === now.toDateString()) return timeOnly.format(date);
  return (date.getFullYear() === now.getFullYear() ? dayMonth : fullDate).format(date);
}

/** Première lettre affichée dans la pastille de l'expéditeur. */
export function senderInitial(message: Pick<MailMessage, "from_name" | "from_address">) {
  return (message.from_name || message.from_address).trim().charAt(0).toUpperCase() || "?";
}

/** Nombre de mails par catégorie, pour les pastilles du filtre. */
export function countByCategory(messages: MailMessage[]) {
  const counts = Object.fromEntries(categoryOrder.map((category) => [category, 0])) as Record<Category, number>;
  for (const message of messages) counts[message.category] += 1;
  return counts;
}

/** Le statut proposé par un mail peut-il encore être appliqué à la main ? */
export function canApply(message: MailMessage) {
  return Boolean(message.application_id && message.suggested_status && !message.status_applied);
}
