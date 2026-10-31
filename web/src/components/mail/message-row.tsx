"use client";

import { ArrowUpRight, Check, Link2, Tag, Undo2 } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import type { ApplicationSummary } from "@/lib/applications";
import { canApply, categories, categoryOrder, type Category, type MailMessage } from "@/lib/mail";
import { spring } from "@/lib/motion";
import { applicationStatuses } from "@/lib/statuses";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Un mail classé : catégorie, candidature liée, statut appliqué ou proposé, et les corrections possibles. */
export function MessageRow({
  message,
  application,
  applications,
  onUpdate,
  onApply,
}: {
  message: MailMessage;
  application?: ApplicationSummary;
  applications: ApplicationSummary[];
  onUpdate: (changes: Partial<Pick<MailMessage, "category" | "application_id" | "reviewed">>) => void;
  onApply: () => void;
}) {
  const { label, tone, icon: Icon } = categories[message.category];
  const suggested = message.suggested_status ? applicationStatuses[message.suggested_status].label : null;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={spring.smooth}
      className="flex flex-col gap-2.5 py-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge tone={tone}>
          <Icon aria-hidden strokeWidth={2} />
          {label}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{message.subject || "(sans objet)"}</span>
        <time className="text-[12px] tabular-nums text-text-tertiary" dateTime={message.received_at}>
          {dateFormatter.format(new Date(message.received_at))}
        </time>
      </div>
      <p className="text-[12px] text-text-tertiary">{message.from_name ? `${message.from_name} · ${message.from_address}` : message.from_address}</p>
      {message.snippet && <p className="line-clamp-2 text-[13px] text-text-secondary">{message.snippet}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5 text-[12px]">
        {application ? (
          <Link
            href={`/candidatures?id=${application.id}`}
            className="inline-flex min-w-0 items-center gap-1 font-medium text-accent-strong hover:underline"
          >
            <span className="truncate">
              {application.title}
              {application.company ? ` · ${application.company}` : ""}
            </span>
            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
          </Link>
        ) : (
          <span className="text-text-tertiary">Aucune candidature liée</span>
        )}
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

        <div className="ml-auto flex items-center gap-1">
          {canApply(message) && (
            <Button variant="secondary" size="sm" onClick={onApply}>
              Passer à « {suggested} »
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
      {message.reason && <p className="sr-only">Classement : {message.reason}</p>}
    </motion.li>
  );
}
