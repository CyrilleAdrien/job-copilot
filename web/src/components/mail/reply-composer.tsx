"use client";

import { AlertTriangle, Reply, Send, Sparkles, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApiError } from "@/lib/api";
import { addressTypo, canSendReply, draftReply, replyRecipient, replySubject, sendReply, TO_FILL, type MailMessage, type MailReply } from "@/lib/mail";
import { fadeUp, spring } from "@/lib/motion";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Une faute de frappe dans le domaine bloque l'envoi tant qu'elle n'est pas tranchée. */
export function useRecipientCheck(to: string, setTo: (address: string) => void) {
  const [keptAddress, setKeptAddress] = useState<string | null>(null);
  const address = to.trim();
  const typo = address === keptAddress ? null : addressTypo(address);
  const alert = typo && (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[10px] bg-warning-soft px-3 py-2 text-[13px]">
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="min-w-0 flex-1">
        Faute de frappe ? Tu voulais peut-être écrire <strong className="font-medium">{typo}</strong>.
      </span>
      <Button type="button" variant="secondary" size="sm" onClick={() => setTo(typo)}>
        Corriger
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setKeptAddress(address)}>
        Garder mon adresse
      </Button>
    </div>
  );
  return { blocked: Boolean(typo), alert };
}

/** Rappel : le texte contient encore un passage que le modèle ne pouvait pas connaître. */
export function ToFillNotice() {
  return (
    <p role="status" className="flex items-center gap-2 rounded-[10px] bg-warning-soft px-3 py-2 text-[13px]">
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
      Remplace {TO_FILL} par la bonne information avant d&apos;envoyer.
    </p>
  );
}

/** Réponse à un mail, envoyée depuis la boîte qui l'a reçu. Ollama peut proposer un texte ; seul le clic sur Envoyer l'expédie. */
export function ReplyComposer({
  message,
  onSent,
  onCancel,
}: {
  message: MailMessage;
  onSent: (updated: MailMessage) => void;
  onCancel: () => void;
}) {
  const suggested = replyRecipient(message);
  const [to, setTo] = useState(suggested);
  // Le même brouillon garde la même clé : un second clic ne renvoie pas le mail.
  const [clientKey] = useState(() => crypto.randomUUID());
  const [subject, setSubject] = useState(replySubject(message.subject));
  const [body, setBody] = useState("");
  const [previous, setPrevious] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const draft = { to: to.trim(), subject: subject.trim(), body };
  const { blocked, alert } = useRecipientCheck(to, setTo);
  const unfilled = body.includes(TO_FILL);
  const ready = canSendReply(draft) && !blocked && !unfilled && !drafting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      onSent(await sendReply(message.id, draft, clientKey));
    } catch (e) {
      // Le texte reste dans le formulaire : on peut corriger et renvoyer.
      setError(e as ApiError);
    } finally {
      setSending(false);
    }
  }

  async function propose() {
    setDrafting(true);
    setError(null);
    try {
      const proposal = await draftReply(message.id, body);
      setPrevious(body);
      setBody(proposal);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <motion.form
      {...fadeUp}
      transition={spring.smooth}
      aria-label="Répondre à ce mail"
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-[12px] border border-border bg-background-subtle p-3.5"
    >
      <Input
        label="À"
        type="email"
        value={to}
        hint={
          draft.to !== suggested
            ? `Adresse modifiée : la réponse n'ira pas à ${suggested}.`
            : message.reply_to
              ? `Adresse de réponse demandée par ce mail, envoyé par ${message.from_address}.`
              : undefined
        }
        onChange={(event) => setTo(event.target.value)}
      />
      {alert}
      <Input label="Objet" value={subject} maxLength={500} onChange={(event) => setSubject(event.target.value)} />
      <Textarea
        label="Message"
        rows={7}
        value={body}
        maxLength={20000}
        autoFocus
        placeholder="Écris ta réponse, ou tes idées (« oui, mardi 14 h ») à faire rédiger par l'IA."
        onChange={(event) => {
          setBody(event.target.value);
          setPrevious(null);
        }}
      />
      {previous !== null && <p className="text-[12px] text-ai-strong">Proposition de l&apos;IA : relis-la avant d&apos;envoyer, elle peut se tromper.</p>}
      {unfilled && <ToFillNotice />}
      {error && <ErrorBanner error={error} />}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="text-ai-strong" loading={drafting} disabled={sending || !body.trim()} title={body.trim() ? undefined : "Écris d'abord ce que tu veux répondre."} onClick={propose}>
          <Sparkles aria-hidden />
          {drafting ? "Rédaction en cours" : "Rédiger avec l'IA"}
        </Button>
        {previous !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setBody(previous);
              setPrevious(null);
            }}
          >
            <Undo2 aria-hidden />
            Reprendre mon texte
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={sending}>
            Annuler
          </Button>
          <Button type="submit" size="sm" loading={sending} disabled={!ready}>
            <Send aria-hidden />
            Envoyer
          </Button>
        </div>
      </div>
    </motion.form>
  );
}

/** Les réponses déjà envoyées à un mail. */
export function ReplyList({ replies }: { replies: MailReply[] }) {
  if (replies.length === 0) return null;
  return (
    <ul aria-label="Réponses envoyées" className="flex flex-col gap-2 border-l-2 border-border pl-3">
      {replies.map((reply) => (
        <li key={reply.id} className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
            <Reply className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Réponse à {reply.to_address}</span>
            <time className="shrink-0 tabular-nums" dateTime={reply.sent_at}>
              · {dateFormatter.format(new Date(reply.sent_at))}
            </time>
          </span>
          <DeliveryNotice reply={reply} />
          <p className="whitespace-pre-wrap text-[13px] text-text-secondary">{reply.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** Ce qu'on sait du sort d'un mail, quand ce n'est pas un simple « accepté ». */
export function DeliveryNotice({ reply }: { reply: Pick<MailReply, "status" | "error"> }) {
  if (reply.status === "uncertain") {
    return (
      <span className="flex items-start gap-1 text-[12px] text-warning">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {reply.error ?? "Envoi incertain : vérifie ton dossier Envoyés avant de renvoyer."}
      </span>
    );
  }
  if (reply.status === "bounced") {
    return (
      <span className="flex items-start gap-1 text-[12px] text-danger">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Non distribué{reply.error ? ` (${reply.error})` : ""}.
      </span>
    );
  }
  return null;
}
