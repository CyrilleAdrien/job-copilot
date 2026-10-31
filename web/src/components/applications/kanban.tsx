"use client";

import { FileText, GripVertical, MoreHorizontal, Plus, Star } from "lucide-react";
import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { tones, toneBar, toneText } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { byStatus, statusOrder, type ApplicationSummary } from "@/lib/applications";
import { timeAgo, type Offer } from "@/lib/jobs";
import { spring } from "@/lib/motion";
import { applicationStatuses, type ApplicationStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";

const DRAG_TYPE = "application/x-jobcopilot-application";
/** Zone près des bords où le Kanban défile pendant un glisser-déposer, et vitesse maximale. */
const EDGE = 96;
const MAX_SPEED = 22;

/**
 * Image de glissement : une copie de la carte hors écran, sans les transformations d'animation.
 * Sans elle, Chrome capture la couche animée entière (toute la colonne, en transparence).
 */
function setCardDragImage(event: DragEvent, card: HTMLElement | null) {
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const ghost = card.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: "fixed",
    top: "-10000px",
    left: "-10000px",
    width: `${rect.width}px`,
    transform: "none",
    opacity: "1",
    pointerEvents: "none",
    boxShadow: "0 12px 32px -12px rgb(0 0 0 / 0.35)",
  });
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, event.clientX - rect.left, event.clientY - rect.top);
  window.setTimeout(() => ghost.remove(), 0);
}

/** Vitesse de défilement selon la distance au bord : nulle au centre, maximale contre le bord. */
export function edgeSpeed(x: number, left: number, right: number) {
  if (x < left + EDGE) return -Math.ceil(MAX_SPEED * Math.min(1, (left + EDGE - x) / EDGE));
  if (x > right - EDGE) return Math.ceil(MAX_SPEED * Math.min(1, (x - (right - EDGE)) / EDGE));
  return 0;
}

/**
 * Colonnes par statut. Une carte se déplace par glisser-déposer, ou par son menu au clavier ;
 * elle glisse vers sa nouvelle colonne (même layoutId d'une colonne à l'autre).
 */
export function Kanban({
  items,
  columns = statusOrder,
  now,
  onOpen,
  onMove,
  favorites = [],
  onCreate,
}: {
  items: ApplicationSummary[];
  /** Favoris sans candidature, montrés au bas de « À envoyer ». */
  favorites?: { search: string; offer: Offer }[];
  onCreate?: (offerId: number, search: string) => void;
  /** Colonnes affichées (toutes par défaut, ou les statuts filtrés). */
  columns?: ApplicationStatus[];
  now: Date;
  onOpen: (id: string) => void;
  onMove: (id: string, status: ApplicationStatus) => void;
}) {
  const groups = byStatus(items);
  const [over, setOver] = useState<ApplicationStatus | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const speed = useRef(0);
  const frame = useRef<number | null>(null);

  // Défilement horizontal automatique quand une carte approche du bord : on peut la porter d'une extrémité à l'autre.
  function autoScroll(event: DragEvent) {
    const node = scroller.current;
    if (!node || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
    const rect = node.getBoundingClientRect();
    speed.current = edgeSpeed(event.clientX, rect.left, rect.right);
    if (speed.current !== 0 && frame.current === null) {
      const step = () => {
        if (speed.current === 0 || !scroller.current) {
          frame.current = null;
          return;
        }
        scroller.current.scrollLeft += speed.current;
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    }
  }
  function stopScroll() {
    speed.current = 0;
  }
  useEffect(() => {
    window.addEventListener("dragend", stopScroll);
    window.addEventListener("drop", stopScroll);
    return () => {
      window.removeEventListener("dragend", stopScroll);
      window.removeEventListener("drop", stopScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  function drop(event: DragEvent, status: ApplicationStatus) {
    event.preventDefault();
    stopScroll();
    setOver(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    if (id) onMove(id, status);
  }

  return (
    <LayoutGroup>
      <div
        ref={scroller}
        onDragOver={autoScroll}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) stopScroll();
        }}
        className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4"
        role="list"
        aria-label="Candidatures par statut"
      >
        {columns.map((status) => {
          const { label, icon: Icon, tone } = applicationStatuses[status];
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
                "relative flex w-72 shrink-0 flex-col gap-3 rounded-card border bg-background-subtle p-3 transition-colors",
                over === status ? "border-accent-strong/50 bg-accent-soft/50" : "border-border",
              )}
            >
              <span className={cn("absolute inset-x-0 -top-px h-[3px] rounded-t-card", toneBar[tone])} aria-hidden />
              <header className="flex items-center gap-2 px-1 pb-1 pt-1">
                <Icon className={cn("size-4", toneText[tone])} strokeWidth={1.75} aria-hidden />
                <h2 className="text-[13px] font-semibold">{label}</h2>
                <span
                  className={cn(
                    "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
                    tones[tone],
                  )}
                >
                  {column.length}
                </span>
              </header>
              <div className="flex min-h-24 flex-col gap-3">
                {column.map((item) => (
                  <KanbanCard key={item.id} item={item} now={now} onOpen={onOpen} onMove={onMove} />
                ))}
                {status === "draft" && favorites.length > 0 && (
                  <FavoriteGroup favorites={favorites} onCreate={onCreate} />
                )}
                {column.length === 0 && !(status === "draft" && favorites.length > 0) && (
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
  const card = useRef<HTMLElement>(null);
  const { tone } = applicationStatuses[item.status];
  return (
    <motion.article
      ref={card}
      layout
      layoutId={`application-${item.id}`}
      transition={spring.smooth}
      className={cn(
        "group relative rounded-[10px] border border-border bg-surface p-4 shadow-card transition-opacity",
        dragging && "opacity-40",
      )}
    >
      <span className={cn("absolute -left-px inset-y-[-1px] w-[3px] rounded-l-[10px]", toneBar[tone])} aria-hidden />
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(DRAG_TYPE, item.id);
          event.dataTransfer.effectAllowed = "move";
          setCardDragImage(event, card.current);
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
        className="flex cursor-grab flex-col gap-2 active:cursor-grabbing"
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

/** Offres en favori sans candidature : une carte en pointillés, transformée d'un clic. */
function FavoriteGroup({
  favorites,
  onCreate,
}: {
  favorites: { search: string; offer: Offer }[];
  onCreate?: (offerId: number, search: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      <p className="flex items-center gap-1.5 px-1 text-[12px] font-medium text-text-tertiary">
        <Star className="size-3.5" aria-hidden />
        Favoris sans candidature
        <span className="tabular-nums">{favorites.length}</span>
      </p>
      {favorites.map(({ search, offer }) => (
        <motion.article
          key={offer.id}
          layout
          layoutId={`favorite-${offer.id}`}
          transition={spring.smooth}
          className="flex flex-col gap-2 rounded-[10px] border border-dashed border-border-strong bg-surface/60 p-4"
        >
          <Link href={`/offres/${offer.id}`} className="text-[13px] font-semibold leading-snug hover:text-accent-strong">
            {offer.title}
          </Link>
          <p className="truncate text-[12px] text-text-secondary">{offer.company ?? "Entreprise non précisée"}</p>
          {onCreate && (
            <Button variant="secondary" size="sm" className="mt-1 self-start" onClick={() => onCreate(offer.id, search)}>
              <Plus aria-hidden />
              Créer la candidature
            </Button>
          )}
        </motion.article>
      ))}
    </div>
  );
}
