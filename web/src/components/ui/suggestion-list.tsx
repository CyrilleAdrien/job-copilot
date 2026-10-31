"use client";

import { AnimatePresence, motion } from "motion/react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Liste de suggestions sous un champ. Le champ garde le focus : le clic passe par onMouseDown. */
export function SuggestionList({
  id,
  open,
  items,
  active,
  onPick,
}: {
  id: string;
  open: boolean;
  items: string[];
  active: number;
  onPick: (item: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && items.length > 0 && (
        <motion.ul
          id={id}
          role="listbox"
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={spring.snappy}
          className="absolute inset-x-0 top-full z-30 mt-1 origin-top overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]"
        >
          {items.map((item, index) => (
            <li
              key={item}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(item);
              }}
              className={cn(
                "cursor-pointer rounded-[8px] px-2.5 py-1.5 text-sm transition-colors",
                index === active ? "bg-accent-soft text-accent-strong" : "text-text hover:bg-surface-hover",
              )}
            >
              {item}
            </li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}

/** Navigation au clavier commune : flèches, Entrée pour choisir, Échap pour fermer. */
export function useSuggestionKeys({
  items,
  active,
  setActive,
  setOpen,
  onPick,
}: {
  items: string[];
  active: number;
  setActive: (index: number) => void;
  setOpen: (open: boolean) => void;
  onPick: (item: string) => void;
}) {
  return (event: React.KeyboardEvent<HTMLInputElement>): boolean => {
    if (event.key === "ArrowDown" && items.length) {
      event.preventDefault();
      setOpen(true);
      setActive((active + 1) % items.length);
      return true;
    }
    if (event.key === "ArrowUp" && items.length) {
      event.preventDefault();
      setActive((active - 1 + items.length) % items.length);
      return true;
    }
    if (event.key === "Enter" && active >= 0 && items[active]) {
      event.preventDefault();
      onPick(items[active]);
      return true;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return true;
    }
    return false;
  };
}
