import type { MailAccount } from "@/lib/mail";
import { cn } from "@/lib/utils";

/** Vert : la boîte est lue et peut envoyer. Rouge : la lecture ou l'envoi échoue. */
function statusLabel(account: MailAccount) {
  if (account.last_error) return "Erreur de lecture";
  if (account.smtp_error) return "Envoi impossible";
  return "Connectée";
}

/** Les boîtes connectées, à côté des boutons du bandeau. */
export function AccountChips({ accounts }: { accounts: MailAccount[] }) {
  return accounts.map((account) => {
    const label = statusLabel(account);
    return (
      <span key={account.id} className="inline-flex h-11 min-w-0 max-w-72 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm" title={`${account.email} : ${label}`}>
        <span role="img" aria-label={label} className={cn("size-2 shrink-0 rounded-full", label === "Connectée" ? "bg-success" : "bg-danger")} />
        <span className="truncate">{account.email}</span>
      </span>
    );
  });
}

/** Le détail des pannes : trop long pour le bandeau, et il ne doit pas passer inaperçu. */
export function AccountErrors({ accounts }: { accounts: MailAccount[] }) {
  const failing = accounts.filter((account) => account.last_error || account.smtp_error);
  if (failing.length === 0) return null;
  return (
    <div role="alert" className="mb-4 flex flex-col gap-1 rounded-card border border-border bg-danger-soft px-4 py-3 text-[13px] text-danger">
      {failing.map((account) => (
        <div key={account.id} className="flex min-w-0 flex-col gap-0.5">
          {account.last_error && (
            <p className="break-words">
              {account.email} : {account.last_error}
            </p>
          )}
          {account.smtp_error && (
            <p className="break-words">
              {account.email}, envoi impossible : {account.smtp_error}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
