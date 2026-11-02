"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ProfileAvatar, useProfileIdentity } from "@/components/profile/profile-identity";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/** Recherche dans les offres, apparence et profil, en haut de chaque page. */
export function TopBar() {
  const { name } = useProfileIdentity();
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
    <div className="flex h-[76px] items-center gap-4">
      <form role="search" onSubmit={submit} className="min-w-0 flex-1">
        <label className="flex h-12 items-center gap-3 rounded-full border border-border bg-surface px-5 transition-[border-color,box-shadow] duration-150 focus-within:border-text hover:border-border-strong hover:shadow-[0_2px_10px_rgb(31_31_31/0.06)]">
          <Search className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">Rechercher une offre</span>
          <input
            type="search"
            value={text}
            maxLength={200}
            onChange={(event) => setText(event.target.value)}
            placeholder="Rechercher une offre : poste, entreprise, ville"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-text-tertiary focus:outline-none"
          />
        </label>
      </form>
      <ThemeToggle />
      <Link
        href="/profil"
        aria-label="Mon profil"
        title={name ?? "Mon profil"}
        className="flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 hover:scale-105 hover:bg-surface-hover"
      >
        <ProfileAvatar size={36} />
      </Link>
    </div>
  );
}
