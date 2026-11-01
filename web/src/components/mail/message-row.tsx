"use client";

import { Check, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categories, listDate, type MailMessage, type MailReply } from "@/lib/mail";
import { cn } from "@/lib/utils";

const ROW = "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-background-subtle md:grid-cols-[180px_minmax(0,1fr)_auto]";

/** Une ligne, comme dans une messagerie : expéditeur, objet, début du texte, date. En gras : à vérifier. */
export function MessageRow({
  message,
  onOpen,
  onToggleReviewed,
}: {
  message: MailMessage;
  onOpen: () => void;
  onToggleReviewed: () => void;
}) {
  const { label, tone } = categories[message.category];
  const unread = !message.reviewed;
  const subject = message.subject || "(sans objet)";
  // Un accusé de réception ou un mail sans catégorie n'apporte rien de plus dans la liste.
  const showLabel = message.category !== "acknowledgment" && message.category !== "other";

  return (
    <li className="group relative">
      <button type="button" onClick={onOpen} className={ROW}>
        <span className={cn("truncate", unread ? "font-semibold" : "text-text-secondary")}>{message.from_name || message.from_address}</span>
        <time className={cn("col-start-2 row-start-1 text-[12px] tabular-nums md:col-start-3", unread ? "font-semibold" : "text-text-tertiary")} dateTime={message.received_at}>
          {listDate(message.received_at)}
        </time>
        <span className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1 md:col-start-2 md:row-start-1">
          {showLabel && <Badge tone={tone}>{label}</Badge>}
          <span className="min-w-0 truncate">
            <span className={cn(unread && "font-semibold")}>{subject}</span>
            {message.snippet && <span className="text-text-tertiary"> – {message.snippet}</span>}
          </span>
        </span>
      </button>
      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 bg-background-subtle md:group-focus-within:block md:group-hover:block">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`${message.reviewed ? "Remettre à vérifier" : "Marquer comme traité"} : ${subject}`}
          title={message.reviewed ? "Remettre à vérifier" : "Marquer comme traité"}
          onClick={onToggleReviewed}
        >
          {message.reviewed ? <Undo2 aria-hidden /> : <Check aria-hidden />}
        </Button>
      </div>
    </li>
  );
}

/** Un mail envoyé dans la liste. Seul un problème de distribution ajoute une mention. */
export function SentRow({ reply, onOpen }: { reply: MailReply; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={ROW}>
        <span className="truncate text-text-secondary">À : {reply.to_address}</span>
        <time className="col-start-2 row-start-1 text-[12px] tabular-nums text-text-tertiary md:col-start-3" dateTime={reply.sent_at}>
          {listDate(reply.sent_at)}
        </time>
        <span className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1 md:col-start-2 md:row-start-1">
          {reply.status === "bounced" && <Badge tone="danger">Non distribué</Badge>}
          {reply.status === "uncertain" && <Badge tone="warning">Incertain</Badge>}
          <span className="min-w-0 truncate">
            {reply.subject}
            <span className="text-text-tertiary"> – {reply.body}</span>
          </span>
        </span>
      </button>
    </li>
  );
}
