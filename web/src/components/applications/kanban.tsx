"use client";

import { FileText, GripVertical, MoreHorizontal } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useState, type DragEvent } from "react";

import { Menu } from "@/components/ui/menu";
import { byStatus, statusOrder, type ApplicationSummary } from "@/lib/applications";
import { timeAgo } from "@/lib/jobs";
import { spring } from "@/lib/motion";
import { applicationStatuses, type ApplicationStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";

const DRAG_TYPE = "application/x-jobcopilot-application";

/**
 * Colonnes par statut. Une carte se déplace par glisser-déposer, ou par son menu au clavier ;
 * elle glisse vers sa nouvelle colonne (même layoutId d'une colonne à l'autre).
 */
export function Kanban({
  items,
  now,
  onOpen,
  onMove,
}: {
  items: ApplicationSummary[];
  now: Date;
  onOpen: (id: string) => void;
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  const groups = byStatus(items);
  const [over, setOver] = useState<ApplicationStatus | null>(null);

  function drop(event: DragEvent, status: ApplicationStatus) {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    if (id) onMove(id, status);
  }

  return (
    <LayoutGroup>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4" role="list" aria-label="Candidatures par statut">
        {statusOrder.map((status) => {
          const { label, icon: Icon } = applicationStatuses[status];
          const column = groups[status];
          return (
            <section
              key={status}
              role="listitem"
              aria-label={`${label}, ${column.length}`}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                event.preventDefault();
                setOver(status);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(event) => drop(event, status)}
              className={cn(
                "flex w-64 shrink-0 flex-col gap-2 rounded-card border bg-background-subtle p-2 transition-colors",
                over === status ? "border-accent-strong/50 bg-accent-soft/50" : "border-border",
              )}
            >
              <header className="flex items-center gap-2 px-1.5 pb-1 pt-1">
                <Icon className="size-4 text-text-tertiary" strokeWidth={1.75} aria-hidden />
                <h2 className="text-[13px] font-semibold">{label}</h2>
                <span className="ml-auto text-[12px] tabular-nums text-text-tertiary">{column.length}</span>
              </header>
              <div className="flex min-h-24 flex-col gap-2">
                {column.map((item) => (
                  <KanbanCard key={item.id} item={item} now={now} onOpen={onOpen} onMove={onMove} />
                ))}
                {column.length === 0 && (
                  <p className="px-1.5 py-4 text-center text-[12px] text-text-tertiary">Glisse une carte ici</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function KanbanCard({
  item,
  now,
  onOpen,
  onMove,
}: {
  item: ApplicationSummary;
  now: Date;
  onOpen: (id: string) => void;
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <motion.article
      layout
      layoutId={`application-${item.id}`}
      transition={spring.smooth}
      className={cn(
        "group relative rounded-[10px] border border-border bg-surface p-3 shadow-card transition-opacity",
        dragging && "opacity-40",
      )}
    >
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(DRAG_TYPE, item.id);
          event.dataTransfer.effectAllowed = "move";
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
        className="flex cursor-grab flex-col gap-1.5 active:cursor-grabbing"
      >
        <button
          type="button"
          onClick={() => onOpen(item.id)}
          className="pr-6 text-left text-[13px] font-semibold leading-snug hover:text-accent-strong"
        >
          {item.title}
        </button>
        <p className="truncate text-[12px] text-text-secondary">{item.company ?? "Entreprise non précisée"}</p>
        <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
          <span>{timeAgo(item.applied_at ?? item.created_at, now)}</span>
          {(item.cv_document_id || item.letter_document_id) && (
            <span className="inline-flex items-center gap-1" title="Documents joints">
              <FileText className="size-3" aria-hidden />
              {[item.cv_document_id && "CV", item.letter_document_id && "Lettre"].filter(Boolean).join(" + ")}
            </span>
          )}
          <GripVertical className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        </div>
      </div>
      <div className="absolute right-1.5 top-1.5">
        <Menu
          label={`Changer le statut de « ${item.title} »`}
          align="end"
          triggerClassName="flex size-6 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text"
          trigger={<MoreHorizontal className="size-4" aria-hidden />}
          items={statusOrder
            .filter((status) => status !== item.status)
            .map((status) => {
              const { label, icon: Icon } = applicationStatuses[status];
              return { label: `Passer à « ${label} »`, icon: <Icon aria-hidden />, onSelect: () => onMove(item.id, status) };
            })}
        />
      </div>
    </motion.article>
  );
}
