"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { checkSending, updateSmtpServer, type MailAccount } from "@/lib/mail";

/** L'état de l'envoi d'une boîte : un test sans mail envoyé, et le serveur à corriger au besoin. */
export function SendSettings({ account, onChange }: { account: MailAccount; onChange: (account: MailAccount) => void }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [host, setHost] = useState(account.smtp_host ?? "");
  const [port, setPort] = useState(String(account.smtp_port ?? 587));
  const [error, setError] = useState<string | null>(null);

  if (!account.smtp_host) return null;

  async function run(action: () => Promise<MailAccount>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Test impossible.");
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    run(() => updateSmtpServer(account.id, { host: host.trim(), port: Number(port) }));
  }

  const failure = error ?? account.smtp_error;
  return (
    <div className="flex flex-col gap-2 pt-1">
      <span className="text-[12px] text-text-tertiary">
        Envoi par {account.smtp_host}:{account.smtp_port}
      </span>
      {failure ? (
        <span role="alert" className="flex items-start gap-1 text-[12px] text-danger">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {failure}
        </span>
      ) : account.smtp_checked_at ? (
        <span className="flex items-center gap-1 text-[12px] text-success">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          Connexion d&apos;envoi vérifiée
        </span>
      ) : (
        <span className="text-[12px] text-text-tertiary">Envoi pas encore testé</span>
      )}
      {editing ? (
        <form aria-label="Serveur d'envoi" onSubmit={save} className="flex flex-wrap items-end gap-2">
          <Input label="Serveur d'envoi" value={host} onChange={(event) => setHost(event.target.value)} />
          <Input label="Port" type="number" min={1} max={65535} className="w-24" value={port} onChange={(event) => setPort(event.target.value)} />
          <Button type="submit" size="sm" loading={busy} disabled={!host.trim() || !port}>
            Enregistrer et tester
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
            Annuler
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" loading={busy} onClick={() => run(() => checkSending(account.id))}>
            Tester l&apos;envoi
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(true)}>
            Modifier le serveur
          </Button>
        </div>
      )}
      {!editing && <span className="text-[12px] text-text-tertiary">Le test se connecte sans envoyer de mail.</span>}
    </div>
  );
}
