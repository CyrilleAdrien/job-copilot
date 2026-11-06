"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Une section repliable, repliée par défaut. Son contenu n'existe que lorsqu'elle est ouverte. */
export function Fold({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-[12px] border border-border bg-surface transition-colors hover:border-border-strong">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-sm font-medium"
        >
          {Icon && <Icon className="size-4 shrink-0 text-text-secondary" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <ChevronRight className={cn("size-4 shrink-0 text-text-tertiary transition-transform duration-150", open && "rotate-90")} aria-hidden />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
