import type { Transition } from "motion/react";

/** Ressorts communs : courts, sans rebond excessif, proches des transitions iOS. */
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 38, mass: 0.8 },
  smooth: { type: "spring", stiffness: 260, damping: 30 },
  gentle: { type: "spring", stiffness: 160, damping: 26 },
} satisfies Record<string, Transition>;

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};
