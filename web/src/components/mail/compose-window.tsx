"use client";

import { Send, X } from "lucide-react";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";

import { useRecipientCheck } from "@/components/mail/reply-composer";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApiError } from "@/lib/api";
import { canSendReply, sendNewMail, type MailAccount, type MailReply } from "@/lib/mail";
import { fadeUp, spring } from "@/lib/motion";

/** Nouveau message, dans une fenêtre en bas de l'écran : la liste reste visible derrière. */
export function ComposeWindow({
  accounts,
  onSent,
  onClose,
}: {
  accounts: MailAccount[];
  onSent: (sent: MailReply) => void;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // Le même brouillon garde la même clé : un second clic ne renvoie pas le mail.
  const [clientKey] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const draft = { to: to.trim(), subject: subject.trim(), body };
  const { blocked, alert } = useRecipientCheck(to, setTo);
  const ready = canSendReply(draft) && !blocked;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      onSent(await sendNewMail(accountId, draft, clientKey));
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.form
      {...fadeUp}
      transition={spring.smooth}
      aria-label="Nouveau message"
      onSubmit={submit}
      className="fixed inset-x-4 bottom-4 z-40 flex max-h-[85vh] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-lg sm:left-auto sm:right-6 sm:w-[520px]"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-medium">Nouveau message</h2>
        <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Fermer" disabled={sending} onClick={onClose}>
          <X aria-hidden />
        </Button>
      </header>
      <div className="flex flex-col gap-3 overflow-y-auto p-4">
        {accounts.length > 1 ? (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            De
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="h-10 rounded-[10px] border border-border bg-surface px-3 text-sm font-normal"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.email}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-[13px] text-text-tertiary">De {accounts[0].email}</p>
        )}
        <Input label="À" type="email" value={to} autoFocus onChange={(event) => setTo(event.target.value)} />
        {alert}
        <Input label="Objet" value={subject} maxLength={500} onChange={(event) => setSubject(event.target.value)} />
        <Textarea label="Message" rows={8} value={body} maxLength={20000} onChange={(event) => setBody(event.target.value)} />
        {error && <ErrorBanner error={error} />}
      </div>
      <footer className="flex justify-end border-t border-border px-4 py-2.5">
        <Button type="submit" size="sm" loading={sending} disabled={!ready}>
          <Send aria-hidden />
          Envoyer
        </Button>
      </footer>
    </motion.form>
  );
}
