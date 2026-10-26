import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Bloc de chargement au contour du contenu attendu, avec un reflet qui le traverse. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-hover",
        "after:absolute after:inset-0 after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent",
        "dark:after:via-white/5",
        className,
      )}
      {...props}
    />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-card border border-border bg-surface p-5">
      <Skeleton className="size-10 rounded-[10px]" />
      <div className="flex flex-1 flex-col gap-2.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}
