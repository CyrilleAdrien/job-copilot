"use client";

import { CircleAlert } from "lucide-react";
import { motion } from "motion/react";

import type { ApiError } from "@/lib/api";
import { fadeUp, spring } from "@/lib/motion";

export function ErrorBanner({ error }: { error: ApiError }) {
  return (
    <motion.div
      {...fadeUp}
      transition={spring.smooth}
      role="alert"
      className="flex gap-3 rounded-card border border-danger/30 bg-danger-soft p-4 text-sm"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="flex flex-col gap-1">
        <span className="font-medium text-danger">{error.message}</span>
        {error.details.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-text-secondary">
            {error.details.slice(0, 6).map((detail) => (
              <li key={`${detail.loc}-${detail.msg}`}>
                <code className="text-xs">{detail.loc}</code> : {detail.msg}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
