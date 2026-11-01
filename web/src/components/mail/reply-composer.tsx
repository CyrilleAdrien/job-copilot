"use client";

import { Reply, Send, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApiError } from "@/lib/api";
import { canSendReply, replySubject, sendReply, type MailMessage, type MailReply } from "@/lib/mail";
import { fadeUp, spring } from "@/lib/motion";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Réponse écrite à la main, envoyée depuis la boîte qui a reçu le mail. */
export function ReplyComposer({
  message,
  onSent,
  onCancel,
}: {
  message: MailMessage;
  onSent: (updated: MailMessage) => void;
  onCancel: () => void;
}) {
  const [to, setTo] = useState(message.from_address);
  const [subject, setSubject] = useState(replySubject(message.subject));
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const draft = { to: to.trim(), subject: subject.trim(), body };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSendReply(draft) || sending) return;
    setSending(true);
    setError(null);
    try {
      onSent(await sendReply(message.id, draft));
    } catch (e) {
      // Le texte reste dans le formulaire : on peut corriger et renvoyer.
      setError(e as ApiError);
    } finally {
      setSending(false);
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
      <Input label="À" type="email" value={to} onChange={(event) => setTo(event.target.value)} />
      <Input label="Objet" value={subject} maxLength={500} onChange={(event) => setSubject(event.target.value)} />
      <Textarea label="Message" rows={6} value={body} maxLength={20000} autoFocus onChange={(event) => setBody(event.target.value)} />
      {error && <ErrorBanner error={error} />}
      <div className="flex flex-wrap items-center gap-2">
        {/* La rédaction avec Ollama viendra ici : pour l'instant, le bouton ne fait rien. */}
        <Button type="button" variant="ghost" size="sm" className="text-ai-strong" disabled>
          <Sparkles aria-hidden />
          Aide à la rédaction
          <span className="rounded-full bg-ai-soft px-1.5 text-[11px] font-medium">Bientôt</span>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={sending}>
            Annuler
          </Button>
          <Button type="submit" size="sm" loading={sending} disabled={!canSendReply(draft)}>
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
          <p className="whitespace-pre-wrap text-[13px] text-text-secondary">{reply.body}</p>
        </li>
      ))}
    </ul>
  );
}
