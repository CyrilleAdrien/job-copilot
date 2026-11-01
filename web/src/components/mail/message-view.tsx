"use client";

import { ArrowLeft, ArrowUpRight, CalendarPlus, Check, Link2, Reply, Tag, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DeliveryNotice, ReplyComposer, ReplyList } from "@/components/mail/reply-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import type { ApplicationSummary } from "@/lib/applications";
import { canApply, categories, categoryOrder, senderInitial, type Category, type MailMessage, type MailReply } from "@/lib/mail";
import { applicationStatuses } from "@/lib/statuses";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="size-8" aria-label="Retour à la liste" title="Retour à la liste" onClick={onBack}>
      <ArrowLeft aria-hidden />
    </Button>
  );
}

function ApplicationLink({ application }: { application: ApplicationSummary }) {
  return (
    <Link href={`/candidatures?id=${application.id}`} className="inline-flex min-w-0 items-center gap-1 font-medium text-accent-strong hover:underline">
      <span className="truncate">
        {application.title}
        {application.company ? ` · ${application.company}` : ""}
      </span>
      <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
    </Link>
  );
}

/** Un mail ouvert : son texte, ce qu'il change pour la candidature, et les réponses. */
export function MessageView({
  message,
  application,
  applications,
  onBack,
  onUpdate,
  onApply,
  onReplied,
}: {
  message: MailMessage;
  application?: ApplicationSummary;
  applications: ApplicationSummary[];
  onBack: () => void;
  onUpdate: (changes: Partial<Pick<MailMessage, "category" | "application_id" | "reviewed">>) => void;
  onApply: () => void;
  onReplied: (updated: MailMessage) => void;
}) {
  const [replying, setReplying] = useState(false);
  const { label, tone, icon: Icon } = categories[message.category];
  const suggested = message.suggested_status ? applicationStatuses[message.suggested_status].label : null;

  return (
    <article aria-label={message.subject || "Mail sans objet"} className="flex flex-col">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <BackButton onBack={onBack} />
        <div className="ml-auto flex items-center gap-1">
          {application && (message.category === "interview" || message.category === "technical_test") && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/calendrier?new=1&application_id=${application.id}&kind=${message.category}`}>
                <CalendarPlus aria-hidden />
                Planifier
              </Link>
            </Button>
          )}
          <Menu
            label="Rattacher à une candidature"
            align="end"
            trigger={<Link2 className="size-4" aria-hidden />}
            items={[
              ...applications.map((item) => ({
                label: `${item.title}${item.company ? ` · ${item.company}` : ""}`,
                onSelect: () => onUpdate({ application_id: item.id }),
              })),
              ...(message.application_id
                ? [{ label: "Détacher", tone: "danger" as const, separated: true, onSelect: () => onUpdate({ application_id: null }) }]
                : []),
            ]}
          />
          <Menu
            label="Corriger la catégorie"
            align="end"
            trigger={<Tag className="size-4" aria-hidden />}
            items={categoryOrder
              .filter((category) => category !== message.category)
              .map((category: Category) => {
                const { label: name, icon: CategoryIcon } = categories[category];
                return { label: name, icon: <CategoryIcon aria-hidden />, onSelect: () => onUpdate({ category }) };
              })}
          />
          {message.reviewed ? (
            <Button variant="ghost" size="sm" onClick={() => onUpdate({ reviewed: false })}>
              <Undo2 aria-hidden />
              À revoir
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onUpdate({ reviewed: true })}>
              <Check aria-hidden />
              Traité
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <header className="flex flex-wrap items-center gap-3">
          <h2 className="min-w-0 text-xl font-semibold tracking-tight">{message.subject || "(sans objet)"}</h2>
          <Badge tone={tone}>
            <Icon aria-hidden strokeWidth={2} />
            {label}
          </Badge>
        </header>

        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent-strong">
            {senderInitial(message)}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
            <p className="min-w-0 truncate text-sm">
              <span className="font-medium">{message.from_name || message.from_address}</span>
              {message.from_name && <span className="text-[12px] text-text-tertiary"> &lt;{message.from_address}&gt;</span>}
            </p>
            <time className="text-[12px] tabular-nums text-text-tertiary" dateTime={message.received_at}>
              {dateFormatter.format(new Date(message.received_at))}
            </time>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-background-subtle px-3 py-2 text-[13px]">
          {application ? <ApplicationLink application={application} /> : <span className="text-text-tertiary">Aucune candidature liée</span>}
          {application && message.match_reason?.endsWith("à confirmer") && (
            <span className="text-warning" title="Plusieurs candidatures en cours chez cette entreprise">
              Rattachement à confirmer
            </span>
          )}
          {message.status_applied && suggested && (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="size-3.5" aria-hidden />
              Passée à « {suggested} »
            </span>
          )}
          {canApply(message) && (
            <Button variant="secondary" size="sm" className="ml-auto" onClick={onApply}>
              Passer à « {suggested} »
            </Button>
          )}
        </div>

        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.snippet || "Ce mail n'a pas de texte."}</p>
        <ReplyList replies={message.replies} />

        {replying ? (
          <ReplyComposer
            message={message}
            onCancel={() => setReplying(false)}
            onSent={(updated) => {
              setReplying(false);
              onReplied(updated);
            }}
          />
        ) : (
          <Button variant="secondary" className="self-start" onClick={() => setReplying(true)}>
            <Reply aria-hidden />
            Répondre
          </Button>
        )}
      </div>
    </article>
  );
}

/** Un mail envoyé, ouvert : son destinataire, son sort et son texte. */
export function SentView({ reply, original, onBack, onOpenOriginal }: { reply: MailReply; original?: MailMessage; onBack: () => void; onOpenOriginal: () => void }) {
  return (
    <article aria-label={reply.subject} className="flex flex-col">
      <div className="flex items-center border-b border-border px-2 py-1.5">
        <BackButton onBack={onBack} />
      </div>
      <div className="flex flex-col gap-4 p-5">
        <h2 className="text-xl font-semibold tracking-tight">{reply.subject}</h2>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
          <p className="min-w-0 truncate">À {reply.to_address}</p>
          <time className="text-[12px] tabular-nums text-text-tertiary" dateTime={reply.sent_at}>
            {dateFormatter.format(new Date(reply.sent_at))}
          </time>
        </div>
        <DeliveryNotice reply={reply} />
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{reply.body}</p>
        {original && (
          <Button variant="ghost" size="sm" className="self-start" onClick={onOpenOriginal}>
            <Reply aria-hidden />
            Voir le mail d&apos;origine
          </Button>
        )}
      </div>
    </article>
  );
}
