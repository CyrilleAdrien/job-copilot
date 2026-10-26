"use client";

import { motion } from "motion/react";

import { spring } from "@/lib/motion";

const RADIUS = 13;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Anneau de pertinence (0 à 100), à la manière des anneaux d'activité. */
export function ScoreRing({ score }: { score: number }) {
  return (
    <span
      role="img"
      aria-label={`Pertinence ${score} sur 100`}
      className="relative inline-flex size-8 items-center justify-center"
    >
      <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={RADIUS} fill="none" strokeWidth="3" className="stroke-border" />
        <motion.circle
          cx="16"
          cy="16"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={score >= 70 ? "stroke-accent-strong" : "stroke-text-tertiary"}
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - score / 100) }}
          transition={spring.gentle}
        />
      </svg>
      <span className="text-[11px] font-semibold tabular-nums">{score}</span>
    </span>
  );
}
