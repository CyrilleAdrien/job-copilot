"use client";

import { CalendarPlus, FilePlus2, PenLine, Plus, SearchCheck } from "lucide-react";

import { Menu } from "@/components/ui/menu";
import { CREATE_PARAM } from "@/lib/use-open-from-menu";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Nouvelle candidature", href: `/candidatures?${CREATE_PARAM}=1`, icon: <FilePlus2 aria-hidden /> },
  { label: "Nouveau message", href: `/boite-de-reception?${CREATE_PARAM}=1`, icon: <PenLine aria-hidden /> },
  { label: "Nouvel événement", href: `/calendrier?${CREATE_PARAM}=1`, icon: <CalendarPlus aria-hidden /> },
  { label: "Nouvelle recherche", href: "/bienvenue?recherche=nouvelle", icon: <SearchCheck aria-hidden /> },
];

export function CreateMenu({ collapsed }: { collapsed: boolean }) {
  return (
    <Menu
      label="Créer"
      items={ITEMS}
      triggerClassName={cn(
        "flex h-11 items-center gap-2 rounded-full bg-text text-background transition-[transform,box-shadow] duration-150",
        "hover:-translate-y-px hover:shadow-[0_4px_14px_rgb(31_31_31/0.28)] active:scale-[0.97]",
        collapsed ? "w-11 justify-center" : "pl-3.5 pr-6",
      )}
      trigger={
        <>
          <Plus className="size-5" strokeWidth={1.75} aria-hidden />
          {!collapsed && <span className="text-base font-normal">Créer</span>}
        </>
      }
    />
  );
}
