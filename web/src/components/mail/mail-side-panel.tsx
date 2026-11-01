"use client";

import { ArrowUpRight, ChevronRight, Undo2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProfileAvatar } from "@/components/profile/profile-identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationSummary } from "@/lib/applications";
import { timeAgo } from "@/lib/jobs";
import { categories, sentReplies, treatedMessages, type MailAccount, type MailMessage } from "@/lib/mail";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Colonne de droite de la boîte de réception : les boîtes connectées, puis les envoyés et les traités. */
export function MailSidePanel({
  accounts,
  messages,
  byId,
  onReopen,
}: {
  accounts: MailAccount[];
  messages: MailMessage[];
  byId: Map<string, ApplicationSummary>;
  onReopen: (id: string) => void;
}) {
  const sent = sentReplies(messages);
  const treated = treatedMessages(messages);

  return (
    <aside aria-label="Boîtes connectées, envoyés et traités" className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-8">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          {accounts.map((account) => (
            <div key={account.id} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusLight failing={Boolean(account.last_error)} />
                <span className="truncate text-sm font-medium" title={account.email}>
                  {account.email}
                </span>
              </div>
              <p className={cn("pl-[18px] text-[12px]", account.last_error ? "text-danger" : "text-text-tertiary")}>
                {account.last_error ?? (account.last_sync_at ? `Lue ${timeAgo(account.last_sync_at, new Date())}` : "Connectée, pas encore lue")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Section title="Envoyés" count={sent.length} empty="Aucune réponse envoyée pour l'instant.">
        {sent.map((reply) => {
          const application = reply.message.application_id ? byId.get(reply.message.application_id) : undefined;
          return (
            <li key={reply.id} className="py-2.5 first:pt-0 last:pb-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-2.5 [&::-webkit-details-marker]:hidden">
                  <ProfileAvatar size={24} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium">{reply.to_address}</span>
                    <span className="truncate text-[12px] text-text-secondary">{reply.subject}</span>
                    <time className="text-[12px] tabular-nums text-text-tertiary" dateTime={reply.sent_at}>
                      {dateFormatter.format(new Date(reply.sent_at))}
                    </time>
                  </span>
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-text-tertiary transition-transform duration-150 group-open:rotate-90" aria-hidden />
                </summary>
                <p className="whitespace-pre-wrap break-words pt-2 pl-[34px] text-[13px] text-text-secondary">{reply.body}</p>
                {application && <div className="pl-[34px] pt-1"><ApplicationLink application={application} /></div>}
              </details>
            </li>
          );
        })}
      </Section>

      <Section title="Traités" count={treated.length} empty="Aucun mail traité pour l'instant.">
        {treated.map((message) => {
          const { label, icon: Icon } = categories[message.category];
          const application = message.application_id ? byId.get(message.application_id) : undefined;
          const subject = message.subject || "(sans objet)";
          return (
            <li key={message.id} className="flex items-start gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-medium" title={subject}>{subject}</span>
                <span className="flex items-center gap-1 text-[12px] text-text-tertiary">
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{label} · {dateFormatter.format(new Date(message.received_at))}</span>
                </span>
                {application && <ApplicationLink application={application} />}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Remettre à vérifier : ${subject}`}
                title="À revoir"
                onClick={() => onReopen(message.id)}
              >
                <Undo2 aria-hidden />
              </Button>
            </li>
          );
        })}
      </Section>
    </aside>
  );
}

/** Vert : la dernière lecture a réussi. Rouge : elle a échoué, l'adresse n'est plus lue. */
function StatusLight({ failing }: { failing: boolean }) {
  return (
    <span role="img" aria-label={failing ? "Erreur de lecture" : "Connectée"} className="relative flex size-2 shrink-0">
      {!failing && <span className="absolute inset-0 rounded-full bg-success opacity-60 motion-safe:animate-ping" aria-hidden />}
      <span className={cn("relative size-2 rounded-full", failing ? "bg-danger" : "bg-success")} />
    </span>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-0">
        <CardTitle className="flex items-center gap-2 text-[14px]">
          {title}
          <span className="text-[12px] font-normal tabular-nums text-text-tertiary">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        {count === 0 ? (
          <p className="text-[13px] text-text-tertiary">{empty}</p>
        ) : (
          <ul aria-label={title} className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto">
            {children}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationLink({ application }: { application: ApplicationSummary }) {
  return (
    <Link href={`/candidatures?id=${application.id}`} className="inline-flex min-w-0 max-w-full items-center gap-1 text-[12px] font-medium text-accent-strong hover:underline">
      <span className="truncate">{application.title}</span>
      <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
    </Link>
  );
}
