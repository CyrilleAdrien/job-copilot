"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { fadeUp, spring } from "@/lib/motion";

/** Transition d'entrée de chaque page : léger fondu et glissement vers le haut. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={fadeUp.initial} animate={fadeUp.animate} transition={spring.smooth}>
      {children}
    </motion.div>
  );
}
