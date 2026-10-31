"use client";

import { Copy, Download, PenLine, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { CvPreview } from "@/components/profile/cv-preview";
import { ErrorBanner } from "@/components/profile/error-banner";
import { ImportButton } from "@/components/profile/import-button";
import { ProfileView } from "@/components/profile/profile-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchProfile, profileExportUrl, restoreSearch } from "@/lib/api";
import { fadeUp, spring } from "@/lib/motion";
import type { Profile } from "@/lib/profile";

type View = "cv" | "details";
const views: { value: View; label: string }[] = [
  { value: "cv", label: "CV" },
  { value: "details", label: "Détails" },
];

export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [view, setView] = useState<View>("cv");
  const [stamp, setStamp] = useState(() => Date.now());

  useEffect(() => {
    fetchProfile().then(setProfile).catch((e: ApiError) => {
      setError(e);
      setProfile(null);
    });
  }, []);

  const actions = profile ? (
    <>
      <ImportButton
        variant="ghost"
        onImported={(imported) => {
          setProfile(imported);
          setStamp(Date.now());
        }}
        onError={setError}
      >
        Importer
      </ImportButton>
      <Button variant="secondary" asChild>
        <a href={profileExportUrl} download="profile.yaml">
          <Download aria-hidden />
          Exporter
        </a>
      </Button>
      {profile.searches.length < 10 && (
        <Menu
          label="Nouvelle recherche"
          align="end"
          triggerClassName={buttonVariants({ variant: "secondary" })}
          trigger={
            <>
              <Plus aria-hidden />
              Nouvelle recherche
            </>
          }
          items={[
            { label: "Recherche vide", href: "/bienvenue?recherche=nouvelle", icon: <Plus aria-hidden /> },
            ...profile.searches.map((search) => ({
              label: `À partir de « ${search.name} »`,
              href: `/bienvenue?recherche=${encodeURIComponent(search.id)}`,
              icon: <Copy aria-hidden />,
            })),
          ]}
        />
      )}
      <Button asChild>
        <Link href="/bienvenue">
          <PenLine aria-hidden />
          Modifier
        </Link>
      </Button>
    </>
  ) : null;

  return (
    <>
      <PageHeader title="Profil" description="La base de tes recherches, CV et lettres." actions={actions} />
      <AnimatePresence>{error && <div className="pb-4"><ErrorBanner error={error} /></div>}</AnimatePresence>
      {profile === undefined ? (
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton className="h-36 rounded-card" />
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      ) : profile === null ? (
        <EmptyState
          icon={UserRound}
          title="Aucun profil pour l'instant"
          description="Configure ton profil en quelques minutes, ou importe un profile.yaml."
          action={
            <Button asChild>
              <Link href="/bienvenue">Configurer mon profil</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <SegmentedControl label="Affichage du profil" segments={views} value={view} onChange={setView} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} {...fadeUp} transition={spring.smooth}>
              {view === "cv" ? <CvPreview stamp={stamp} /> : <ProfileView
                  profile={profile}
                  onRestore={(id) => restoreSearch(id).then(setProfile).catch(setError)}
                />}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
