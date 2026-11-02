"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

/** Recherche dans les offres et apparence, en haut de chaque page. */
export function TopBar() {
  const router = useRouter();
  const current = useSearchParams().get("q") ?? "";
  const [text, setText] = useState(current);

  useEffect(() => setText(current), [current]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const query = text.trim();
    router.push(query ? `/offres?q=${encodeURIComponent(query)}` : "/offres");
  }

  return (
    <div className="grid h-[76px] grid-cols-[1fr_minmax(0,440px)_1fr] items-center gap-4">
      <form role="search" onSubmit={submit} className="col-start-2 min-w-0">
        <label className="flex h-10 items-center gap-2.5 rounded-full border border-border bg-surface px-4 transition-[border-color,box-shadow] duration-150 focus-within:border-text hover:border-border-strong hover:shadow-[0_2px_10px_rgb(31_31_31/0.06)]">
          <Search className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="sr-only">Rechercher une offre</span>
          <input
            type="search"
            value={text}
            maxLength={200}
            onChange={(event) => setText(event.target.value)}
            placeholder="Rechercher une offre"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-text-tertiary focus:outline-none"
          />
        </label>
      </form>
      <div className="flex items-center justify-end">
        <ThemeToggle />
      </div>
    </div>
  );
}
