"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  /** Un lien, ou une action. */
  href?: string;
  onSelect?: () => void;
  tone?: "danger";
  /** Trait de séparation au-dessus de l'entrée. */
  separated?: boolean;
};

/** Petit menu déroulant : se ferme au clic extérieur, avec Échap ou après un choix. */
export function Menu({
  trigger,
  label,
  items,
  align = "start",
  triggerClassName,
}: {
  trigger: ReactNode;
  label: string;
  items: MenuItem[];
  /** Côté où s'aligne le menu : « end » pour un bouton placé à droite. */
  align?: "start" | "end";
  /** Remplace l'apparence ronde par défaut du bouton. */
  triggerClassName?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={
          triggerClassName ??
          "flex size-8 items-center justify-center rounded-full border border-border bg-background-subtle text-text-secondary transition-colors hover:text-text"
        }
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={spring.snappy}
            className={cn(
              "absolute top-full z-30 mt-1.5 max-h-80 min-w-60 overflow-y-auto rounded-[12px] border border-border bg-surface p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]",
              align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            )}
          >
            {items.map((item) => {
              const className = cn(
                "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover [&_svg]:size-4",
                item.tone === "danger" ? "text-danger [&_svg]:text-danger" : "text-text [&_svg]:text-text-tertiary",
              );
              const content = (
                <>
                  {item.icon}
                  {item.label}
                </>
              );
              return (
                <div key={item.label}>
                  {item.separated && <div role="separator" className="mx-2 my-1 h-px bg-border" />}
                  {item.href ? (
                    <Link href={item.href} role="menuitem" onClick={() => setOpen(false)} className={className}>
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        item.onSelect?.();
                      }}
                      className={className}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
