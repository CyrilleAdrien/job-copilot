"use client";

import { useLayoutEffect, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const GAP = 6;
const MARGIN = 8;

type Rect = { top: number; bottom: number; left: number; right: number };

/** Place un panneau contre son bouton, sans sortir de l'écran : au-dessus si la place manque dessous. */
export function placeFloating(
  anchor: Rect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  align: "start" | "end",
) {
  const below = viewport.height - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;
  const under = panel.height <= below || below >= above;
  const height = Math.min(panel.height, under ? below : above);
  const wanted = align === "end" ? anchor.right - panel.width : anchor.left;
  return {
    top: under ? anchor.bottom + GAP : anchor.top - GAP - height,
    left: Math.max(MARGIN, Math.min(wanted, viewport.width - panel.width - MARGIN)),
    maxHeight: height < panel.height ? Math.max(0, height) : null,
  };
}

/** Garde le panneau ancré pendant qu'il est ouvert, même si la page défile. */
export function useFloating(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
  align: "start" | "end" = "start",
) {
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const element = panel.current;
      if (!element || !anchor.current) return;
      element.style.maxHeight = "";
      const position = placeFloating(
        anchor.current.getBoundingClientRect(),
        { width: element.offsetWidth, height: element.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        align,
      );
      element.style.top = `${position.top}px`;
      element.style.left = `${position.left}px`;
      if (position.maxHeight !== null) element.style.maxHeight = `${position.maxHeight}px`;
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, panel, align]);
}

/** Rend le panneau hors de la page : ni un bandeau ni une colonne qui défile ne peuvent le couper. */
export function FloatingLayer({ ready, children }: { ready: boolean; children: ReactNode }) {
  return ready ? createPortal(children, document.body) : null;
}
