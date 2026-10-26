"use client";

import { Download, PenLine, UserRound } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ErrorBanner } from "@/components/profile/error-banner";
import { ImportButton } from "@/components/profile/import-button";
import { ProfileView } from "@/components/profile/profile-view";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchProfile, profileExportUrl } from "@/lib/api";
import { fadeUp, spring } from "@/lib/motion";
import type { Profile } from "@/lib/profile";

export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    fetchProfile().then(setProfile).catch((e: ApiError) => {
      setError(e);
      setProfile(null);
    });
  }, []);

  const actions = profile ? (
    <>
      <ImportButton variant="ghost" onImported={setProfile} onError={setError}>
        Importer
      </ImportButton>
      <Button variant="secondary" asChild>
        <a href={profileExportUrl} download="profile.yaml">
          <Download aria-hidden />
          Exporter
        </a>
      </Button>
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
        <motion.div {...fadeUp} transition={spring.smooth}>
          <ProfileView profile={profile} />
        </motion.div>
      )}
    </>
  );
}
