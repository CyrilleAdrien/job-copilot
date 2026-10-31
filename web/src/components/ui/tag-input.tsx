"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type KeyboardEvent } from "react";

import { SuggestionList, useSuggestionKeys } from "@/components/ui/suggestion-list";
import { spring } from "@/lib/motion";
import { filterSuggestions } from "@/lib/suggestions";
import { cn } from "@/lib/utils";

/**
 * Saisie de mots-clés : Entrée ou virgule ajoute une étiquette, Retour arrière retire la dernière.
 * Avec `suggestions`, une liste filtrée s'ouvre pendant la saisie.
 */
export function TagInput({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder,
  hint,
  error,
  suggestions = [],
}: {
  /** Laisser vide quand le champ est déjà nommé par son voisin ; `ariaLabel` le décrit alors. */
  label: string;
  ariaLabel?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  suggestions?: string[];
}) {
  const id = useId();
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const items = suggestions.length ? filterSuggestions(suggestions, draft, value) : [];

  const add = (raw: string) => {
    const items = raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && !value.some((existing) => existing.toLowerCase() === item.toLowerCase()));
    if (items.length) onChange([...value, ...items]);
    setDraft("");
    setActive(-1);
  };

  const suggestionKeys = useSuggestionKeys({ items, active, setActive, setOpen, onPick: add });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggestionKeys(event)) return;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-text">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-[10px] border border-border-strong bg-surface px-2 py-1.5",
          "transition-[border-color,box-shadow] duration-150",
          "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
          error && "border-danger",
        )}
      >
        <AnimatePresence initial={false}>
          {value.map((item) => (
            <motion.span
              key={item}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={spring.snappy}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-hover pl-2.5 pr-1 text-[13px]"
            >
              {item}
              <button
                type="button"
                aria-label={`Retirer ${item}`}
                onClick={() => onChange(value.filter((existing) => existing !== item))}
                className="flex size-5 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-border hover:text-text"
              >
                <X className="size-3" strokeWidth={2.5} aria-hidden />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          id={id}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (draft) add(draft);
          }}
          role={suggestions.length ? "combobox" : undefined}
          aria-expanded={suggestions.length ? open && items.length > 0 : undefined}
          aria-controls={suggestions.length ? listId : undefined}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          placeholder={value.length ? "" : placeholder}
          aria-invalid={error ? true : undefined}
          aria-label={label ? undefined : ariaLabel}
          className="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-text-tertiary"
        />
      </div>
      <div className="relative">
        <SuggestionList id={listId} open={open} items={items} active={active} onPick={add} />
      </div>
      {(error || hint) && (
        <p className={cn("text-xs", error ? "text-danger" : "text-text-tertiary")}>{error ?? hint}</p>
      )}
    </div>
  );
}
