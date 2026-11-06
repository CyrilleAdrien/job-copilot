"use client";

import { Download, FileWarning, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { Page } from "@/components/documents/document-viewer";
import { SearchPicker } from "@/components/profile/search-picker";
import { SearchStudio } from "@/components/studio/search-studio";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchProfilePreview,
  profilePreviewWordUrl,
  profilePreviewPageUrl,
  profilePreviewPdfUrl,
  type Language,
} from "@/lib/documents";
import { mainSearch, type Profile } from "@/lib/profile";

const languages: { value: Language; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

/** Le CV enregistré d'une recherche, mis en page avec le template, tel qu'il sortirait sans ciblage. */
export function CvPreview({
  stamp,
  profile,
  onSaved,
}: {
  stamp: number;
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const { searches } = profile;
  const [chosen, setChosen] = useState<number | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Une recherche archivée entre-temps n'est plus proposée : on revient à la principale.
  const index = chosen !== null && searches[chosen] && !searches[chosen].archived ? chosen : mainSearch({ searches });
  const search = searches[index].id;
  const [language, setLanguage] = useState<Language>("fr");
  const [pages, setPages] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPages(null);
    setFailed(false);
    fetchProfilePreview(language, search)
      .then((preview) => setPages(preview.pages))
      .catch(() => setFailed(true));
  }, [language, stamp, search, refresh]);

  return (
    <div className="flex flex-col gap-4">
      <SearchPicker label="CV de la recherche" searches={searches} value={index} onChange={setChosen} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label="Langue des titres" segments={languages} value={language} onChange={setLanguage} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setCustomizing(true)}>
            <SlidersHorizontal aria-hidden />
            Personnaliser
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href={profilePreviewPdfUrl(language, search)} download="CV.pdf">
              <Download aria-hidden />
              Télécharger le PDF
            </a>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href={profilePreviewWordUrl(language, search)} download="CV.docx">
              <Download aria-hidden />
              Télécharger le Word
            </a>
          </Button>
        </div>
      </div>
      {failed ? (
        <EmptyState
          icon={FileWarning}
          title="Aperçu indisponible"
          description="Le service documents ne répond pas. Vérifie qu'il tourne avec make up."
        />
      ) : pages === null ? (
        <Skeleton className="mx-auto aspect-[210/297] w-full max-w-[720px] rounded-md" />
      ) : (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
          {Array.from({ length: pages }, (_, index) => (
            <Page
              key={`${language}-${stamp}-${refresh}-${search}-${index}`}
              src={profilePreviewPageUrl(language, index + 1, stamp + refresh, search)}
              label={`CV, page ${index + 1}`}
            />
          ))}
        </div>
      )}
      <p className="text-center text-xs text-text-tertiary">
        Toutes les sections du profil, sans adaptation à une offre. Les CV générés pour une offre ne gardent que
        l&apos;essentiel.
      </p>
      {customizing && (
        <SearchStudio
          profile={profile}
          index={index}
          onIndex={setChosen}
          onSaved={onSaved}
          onClose={() => {
            setCustomizing(false);
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
