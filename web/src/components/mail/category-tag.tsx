import { toneBar } from "@/components/ui/badge";
import type { Tone } from "@/lib/statuses";
import { cn } from "@/lib/utils";

/** Le point de couleur d'un mail. Le violet reste à l'IA : les étapes positives passent en or. */
export function ToneDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tone === "ai" ? "bg-accent" : toneBar[tone], className)} />;
}

/** Étiquette sobre : même forme que les filtres du site, la couleur tient dans le point. */
export function CategoryTag({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-background-subtle px-2 text-xs text-text-secondary">
      <ToneDot tone={tone} />
      {label}
    </span>
  );
}
