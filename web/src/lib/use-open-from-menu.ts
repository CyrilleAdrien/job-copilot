"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export const CREATE_PARAM = "nouveau";

/** Ouvre le formulaire d'un écran demandé par le menu Créer, puis retire la demande de l'adresse. */
export function useOpenFromMenu(open: () => void) {
  const requested = useSearchParams().has(CREATE_PARAM);
  const pathname = usePathname();
  const router = useRouter();
  const latest = useRef(open);

  useEffect(() => {
    latest.current = open;
  });

  useEffect(() => {
    if (!requested) return;
    latest.current();
    router.replace(pathname, { scroll: false });
  }, [requested, pathname, router]);
}
