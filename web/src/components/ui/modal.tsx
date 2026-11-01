"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { spring } from "@/lib/motion";

/** Fenêtre centrée : se ferme avec Échap, le bouton de fermeture ou un clic sur le fond. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={spring.snappy}
            className="relative flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-[16px] border border-border bg-background shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)] outline-none"
          >
            <header className="flex items-start gap-4 border-b border-border px-6 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
                  {title}
                </h2>
                {description && <p className="text-[13px] text-text-secondary">{description}</p>}
              </div>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Fermer" onClick={onClose}>
                <X aria-hidden />
              </Button>
            </header>
            <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
