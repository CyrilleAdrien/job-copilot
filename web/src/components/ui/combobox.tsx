"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { SuggestionList, useSuggestionKeys } from "@/components/ui/suggestion-list";
import { filterSuggestions } from "@/lib/suggestions";

/** Champ texte libre avec des suggestions filtrées pendant la saisie. */
export function Combobox({
  label,
  ariaLabel,
  value,
  onChange,
  suggestions,
  placeholder,
  error,
  hint,
}: {
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const items = filterSuggestions(suggestions, value).filter((item) => item !== value);

  const pick = (item: string) => {
    onChange(item);
    setOpen(false);
    setActive(-1);
  };
  const onKeyDown = useSuggestionKeys({ items, active, setActive, setOpen, onPick: pick });

  return (
    <div className="relative">
      <Input
        label={label}
        aria-label={label ? undefined : ariaLabel}
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        error={error}
        hint={hint}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <SuggestionList id={listId} open={open} items={items} active={active} onPick={pick} />
    </div>
  );
}
