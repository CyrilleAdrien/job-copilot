"use client";

import { Archive, ArchiveRestore, Copy, PenLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { archiveSearch, deleteSearch, restoreSearch, type ApiError } from "@/lib/api";
import { fadeUp, spring } from "@/lib/motion";
import { matchModeLabels, seniorityLabels, type Profile, type SearchProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** Liste des recherches du profil, avec leurs actions. L'écran Offres ne fait que choisir. */
export function SearchManager({
  profile,
  onChange,
  onError,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
  onError: (error: ApiError) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const activeCount = profile.searches.filter((search) => !search.archived).length;

  async function run(id: string, action: (id: string) => Promise<Profile>) {
    setBusy(id);
    try {
      onChange(await action(id));
      setConfirming(null);
    } catch (error) {
      onError(error as ApiError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {profile.searches.map((search) => {
        const lastActive = !search.archived && activeCount < 2;
        return (
          <motion.div key={search.id} layout="position" transition={spring.smooth}>
            <Card className={cn(search.archived && "bg-background-subtle")}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className={cn("text-[15px] font-semibold", search.archived && "text-text-secondary")}>
                        {search.name}
                      </h3>
                      {search.archived && <Badge>Archivée</Badge>}
                    </div>
                    <p className="text-sm text-text-secondary">{summary(search)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/bienvenue?modifier=${encodeURIComponent(search.id)}`}>
                        <PenLine aria-hidden />
                        Modifier
                      </Link>
                    </Button>
                    {profile.searches.length < 10 && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/bienvenue?recherche=${encodeURIComponent(search.id)}`}>
                          <Copy aria-hidden />
                          Dupliquer
                        </Link>
                      </Button>
                    )}
                    {search.archived ? (
                      <Button variant="ghost" size="sm" loading={busy === search.id} onClick={() => run(search.id, restoreSearch)}>
                        <ArchiveRestore aria-hidden />
                        Restaurer
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={lastActive}
                        title={lastActive ? "Garde au moins une recherche active." : undefined}
                        loading={busy === search.id}
                        onClick={() => run(search.id, archiveSearch)}
                      >
                        <Archive aria-hidden />
                        Archiver
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-danger"
                      aria-label={`Supprimer « ${search.name} »`}
                      title={lastActive ? "Garde au moins une recherche active." : "Supprimer"}
                      disabled={lastActive}
                      onClick={() => setConfirming(search.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {confirming === search.id && (
                    <motion.div {...fadeUp} transition={spring.smooth}>
                      <div
                        role="alertdialog"
                        aria-label="Confirmer la suppression"
                        className="flex flex-wrap items-center gap-3 rounded-[10px] border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm"
                      >
                        <p className="flex-1 text-text-secondary">
                          Supprimer <span className="font-medium text-text">« {search.name} »</span> et ses favoris ?
                          {!search.archived && " Pour la mettre de côté sans rien perdre, archive-la plutôt."}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                            Annuler
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={busy === search.id}
                            onClick={() => run(search.id, deleteSearch)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function summary(search: SearchProfile): string {
  const skills = search.focus_skills.length ? search.focus_skills : search.technologies;
  const mode =
    search.match_mode === "domain"
      ? matchModeLabels.domain
      : `au moins ${Math.min(search.min_skills, skills.length)} compétence${search.min_skills > 1 ? "s" : ""} parmi ${skills.length}`;
  return [search.roles.join(", "), seniorityLabels[search.seniority], mode].filter(Boolean).join(" · ");
}
