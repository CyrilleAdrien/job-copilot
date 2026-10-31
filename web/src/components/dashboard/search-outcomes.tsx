"use client";

import { Award, Info } from "lucide-react";
import { motion } from "motion/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bestSearchSummary, percent, type Stats } from "@/lib/dashboard";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Quel profil visé (recherche) mène le plus souvent à un test technique ou un entretien.
 * Les retours sont lus dans l'historique : un entretien suivi d'un refus compte comme entretien.
 */
export function SearchOutcomes({ stats, names }: { stats: Stats; names: Record<string, string> }) {
  const rows = stats.by_search;
  if (rows.length === 0) return null;
  const name = (id: string | null) => (id === null ? "Ajoutées à la main" : (names[id] ?? id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil qui fonctionne le mieux</CardTitle>
        <CardDescription>{bestSearchSummary(stats, names)}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-text-tertiary">
                <th className="py-2 pr-4 font-medium">Recherche</th>
                <th className="w-[34%] py-2 pr-4 font-medium">Tests ou entretiens</th>
                <th className="py-2 pr-3 text-right font-medium">Envoyées</th>
                <th className="py-2 pr-3 text-right font-medium">Réponses</th>
                <th className="py-2 pr-3 text-right font-medium">Tests</th>
                <th className="py-2 pr-3 text-right font-medium">Entretiens</th>
                <th className="py-2 pr-3 text-right font-medium">Offres</th>
                <th className="py-2 text-right font-medium">Refus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const isBest = row.search_id !== null && row.search_id === stats.best_search;
                const tooFew = row.search_id !== null && row.sent < stats.min_sample;
                const progress = percent(row.progress_rate) ?? 0;
                return (
                  <tr key={row.search_id ?? "manual"} className="align-middle">
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2">
                        <span className={cn("font-medium", row.search_id === null && "text-text-secondary")}>
                          {name(row.search_id)}
                        </span>
                        {isBest && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 text-[11px] font-medium leading-5 text-success">
                            <Award className="size-3" aria-hidden />
                            Meilleur retour
                          </span>
                        )}
                        {tooFew && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-text-tertiary"
                            title={`Classée à partir de ${stats.min_sample} envois`}
                          >
                            <Info className="size-3" aria-hidden />
                            Trop peu d&apos;envois
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-subtle">
                          <motion.span
                            className={cn("block h-full rounded-full", isBest ? "bg-success" : "bg-accent-strong")}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={spring.smooth}
                          />
                        </span>
                        <span className="w-10 text-right font-medium tabular-nums">{progress} %</span>
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">{row.sent}</td>
                    <td className="py-3 pr-3 text-right tabular-nums text-text-secondary">
                      {row.responded} <span className="text-text-tertiary">({percent(row.response_rate)} %)</span>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">{row.technical_tests}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{row.interviews}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{row.offers}</td>
                    <td className="py-3 text-right tabular-nums text-text-secondary">{row.rejected}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="pt-3 text-[12px] text-text-tertiary">
          D&apos;après l&apos;historique des statuts : une candidature passée par un entretien puis refusée compte comme entretien.
        </p>
      </CardContent>
    </Card>
  );
}
