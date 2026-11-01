"use client";

import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { AccountForm } from "@/components/mail/account-form";
import { SendSettings } from "@/components/mail/send-settings";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/jobs";
import { deleteAccount, type MailAccount } from "@/lib/mail";

/** Les boîtes connectées : lecture, envoi, ajout et déconnexion. */
export function MailAccounts({
  accounts,
  onChange,
  onError,
}: {
  accounts: MailAccount[];
  onChange: () => void;
  onError: (error: unknown) => void;
}) {
  const [adding, setAdding] = useState(false);

  async function remove(id: string) {
    try {
      await deleteAccount(id);
      onChange();
    } catch (e) {
      onError(e);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {accounts.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-start gap-3 py-3 first:pt-0">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{account.email}</span>
                <span className="text-[12px] text-text-tertiary">
                  {account.last_sync_at ? `Lue ${timeAgo(account.last_sync_at, new Date())}` : "Jamais lue"} · {account.messages} mail
                  {account.messages > 1 ? "s" : ""}
                </span>
                {account.last_error && (
                  <span className="flex items-start gap-1 text-[12px] text-danger">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {account.last_error}
                  </span>
                )}
                <SendSettings account={account} onChange={onChange} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-danger"
                aria-label={`Déconnecter ${account.email}`}
                title="Déconnecter"
                onClick={() => remove(account.id)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding || accounts.length === 0 ? (
        <AccountForm
          onAdded={() => {
            setAdding(false);
            onChange();
          }}
          onCancel={accounts.length ? () => setAdding(false) : undefined}
        />
      ) : (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Ajouter une boîte
        </Button>
      )}
    </section>
  );
}
