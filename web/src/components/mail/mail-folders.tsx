"use client";

import { CheckCircle2, CircleDot, Inbox, Pencil, Send, type LucideIcon } from "lucide-react";

import { ToneDot } from "@/components/mail/category-tag";
import { Button } from "@/components/ui/button";
import { categories, categoryOrder, type Category, type MailAccount, type MailFolder } from "@/lib/mail";
import { cn } from "@/lib/utils";

const FOLDERS: { id: MailFolder; label: string; icon: LucideIcon }[] = [
  { id: "inbox", label: "Boîte de réception", icon: Inbox },
  { id: "pending", label: "À vérifier", icon: CircleDot },
  { id: "sent", label: "Envoyés", icon: Send },
  { id: "treated", label: "Traités", icon: CheckCircle2 },
];

/** Colonne de gauche : nouveau message, dossiers, catégories présentes et état des boîtes. */
export function MailFolders({
  folder,
  counts,
  alertSent,
  selected,
  categoryCounts,
  accounts,
  onCompose,
  onFolder,
  onCategory,
}: {
  folder: MailFolder;
  counts: Partial<Record<MailFolder, number>>;
  alertSent: boolean;
  selected: Category[];
  categoryCounts: Record<Category, number>;
  accounts: MailAccount[];
  onCompose: () => void;
  onFolder: (folder: MailFolder) => void;
  onCategory: (category: Category) => void;
}) {
  const present = categoryOrder.filter((item) => categoryCounts[item] > 0 || selected.includes(item));

  return (
    <aside aria-label="Dossiers de la boîte de réception" className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-8">
      <Button className="self-start" onClick={onCompose}>
        <Pencil aria-hidden />
        Nouveau message
      </Button>

      <nav aria-label="Dossiers" className="flex gap-0.5 overflow-x-auto xl:flex-col">
        {FOLDERS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={folder === id ? "page" : undefined}
            onClick={() => onFolder(id)}
            className={cn(
              "group flex h-11 shrink-0 items-center gap-3 rounded-[12px] px-3 text-sm transition-colors duration-150",
              folder === id ? "bg-accent-soft text-text" : "text-text-secondary hover:bg-surface-hover hover:text-text",
            )}
          >
            <Icon className="size-5 shrink-0 transition-transform duration-150 group-hover:scale-110" strokeWidth={1.25} aria-hidden />
            <span className="flex-1 text-left">{label}</span>
            {id === "sent" && alertSent && <span role="img" aria-label="Un mail n'a pas été distribué" className="size-2 rounded-full bg-danger" />}
            {Boolean(counts[id]) && <span className="text-[12px] tabular-nums">{counts[id]}</span>}
          </button>
        ))}
      </nav>

      {folder !== "sent" && present.length > 0 && (
        <div className="hidden flex-col gap-0.5 xl:flex" role="group" aria-label="Catégorie">
          <p className="px-3 pb-1 text-[13px] font-medium text-text">Catégories</p>
          {present.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={selected.includes(item)}
              onClick={() => onCategory(item)}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-[12px] px-3 text-[13px] transition-colors duration-150",
                selected.includes(item) ? "bg-accent-soft text-text" : "text-text-secondary hover:bg-surface-hover hover:text-text",
              )}
            >
              <ToneDot tone={categories[item].tone} />
              <span className="min-w-0 flex-1 truncate text-left">{categories[item].label}</span>
              <span className="text-[12px] tabular-nums">{categoryCounts[item]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border px-3 pt-3">
        {accounts.map((account) => (
          <div key={account.id} className="flex min-w-0 flex-col gap-0.5 text-[12px]">
            <div className="flex min-w-0 items-center gap-2">
              <StatusLight failing={Boolean(account.last_error)} />
              <span className="truncate text-text-secondary" title={account.email}>
                {account.email}
              </span>
            </div>
            {account.last_error && <p className="text-danger">{account.last_error}</p>}
            {account.smtp_error && <p className="text-danger">Envoi impossible : {account.smtp_error}</p>}
          </div>
        ))}
      </div>
    </aside>
  );
}

/** Vert : la dernière lecture a réussi. Rouge : elle a échoué, l'adresse n'est plus lue. */
function StatusLight({ failing }: { failing: boolean }) {
  return <span role="img" aria-label={failing ? "Erreur de lecture" : "Connectée"} className={cn("size-2 shrink-0 rounded-full", failing ? "bg-danger" : "bg-success")} />;
}
