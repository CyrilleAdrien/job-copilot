"use client";

import { Download, Redo2, Undo2, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export type StudioTab<T extends string> = { value: T; label: string; icon: LucideIcon };

/** Le plein écran commun à tous les CV : la barre du haut, les réglages, et le CV toujours visible. */
export function CvStudio<T extends string>({
  title,
  onClose,
  tabs,
  tab,
  onTab,
  selector,
  status,
  actions,
  downloads,
  navigation,
  panel,
  preview,
  history,
}: {
  title: string;
  onClose: () => void;
  tabs: StudioTab<T>[];
  tab: T;
  onTab: (tab: T) => void;
  /** Le choix du CV. */
  selector?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  /** Vide tant que des modifications ne sont pas enregistrées. */
  downloads: { pdf: string; word: string } | null;
  navigation?: ReactNode;
  panel: ReactNode;
  preview: ReactNode;
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
}) {
  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      title={title}
      bar={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2.5">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Fermer" onClick={onClose}>
            <X aria-hidden />
          </Button>
          <div role="tablist" aria-label="Espaces du CV" className="flex items-center gap-1">
            {tabs.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={value === tab}
                onClick={() => onTab(value)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors [&_svg]:size-4",
                  value === tab ? "bg-accent-soft text-text" : "text-text-secondary hover:bg-surface-hover hover:text-text",
                )}
              >
                <Icon aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {status}
            {selector}
            {actions}
            {downloads ? (
              <Menu
                label="Télécharger"
                align="end"
                triggerClassName={buttonVariants({ size: "sm" })}
                trigger={
                  <>
                    <Download aria-hidden />
                    Télécharger
                  </>
                }
                items={[
                  { label: "PDF", href: downloads.pdf, download: true },
                  { label: "Word", href: downloads.word, download: true },
                ]}
              />
            ) : (
              <Button size="sm" disabled title="Enregistre d'abord tes modifications">
                <Download aria-hidden />
                Télécharger
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div
        className={cn(
          "grid min-h-full lg:h-full",
          navigation ? "lg:grid-cols-[170px_minmax(340px,420px)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]",
        )}
      >
        {navigation && <div className="border-border p-3 lg:border-r">{navigation}</div>}
        <div className="flex min-h-0 flex-col gap-4 border-border p-5 lg:overflow-y-auto lg:border-r">{panel}</div>
        <div className="relative min-h-0">
          <div className="h-full bg-background-subtle p-4 pb-20 lg:overflow-y-auto lg:p-8 lg:pb-24">
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">{preview}</div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-card">
              <Button variant="ghost" size="icon" className="size-9" aria-label="Annuler la dernière modification" title="Annuler" disabled={!history.canUndo} onClick={history.undo}>
                <Undo2 aria-hidden />
              </Button>
              <span aria-hidden className="h-5 w-px bg-border" />
              <Button variant="ghost" size="icon" className="size-9" aria-label="Rétablir la modification" title="Rétablir" disabled={!history.canRedo} onClick={history.redo}>
                <Redo2 aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Le menu latéral d'un espace : une section à la fois, le CV reste en regard. */
export function StudioNavigation<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: StudioTab<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map(({ value: item, label: name, icon: Icon }) => (
        <button
          key={item}
          type="button"
          aria-current={item === value ? "true" : undefined}
          onClick={() => onChange(item)}
          className={cn(
            "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors [&_svg]:size-4",
            item === value ? "bg-accent-soft font-medium text-text" : "text-text-secondary hover:bg-surface-hover hover:text-text",
          )}
        >
          <Icon aria-hidden />
          {name}
        </button>
      ))}
    </nav>
  );
}

const CONTROL = "h-9 max-w-52 rounded-full border border-border-strong bg-surface px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-text focus:shadow-[0_0_0_3px_var(--accent-soft)]";

/** Le choix du CV dans la barre du haut. */
export function CvSelector({
  options,
  value,
  onChange,
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
}) {
  if (options.length < 2) return null;
  return (
    <select aria-label="CV de la recherche" className={CONTROL} value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
