"use client";

import { Download, FileWarning } from "lucide-react";
import { useEffect, useState } from "react";

import { Page } from "@/components/documents/document-viewer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchProfilePreview,
  profilePreviewPageUrl,
  profilePreviewPdfUrl,
  type Language,
} from "@/lib/documents";

const languages: { value: Language; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

/** Le profil enregistré, mis en page avec le template de CV, tel qu'il sortirait sans ciblage. */
export function CvPreview({ stamp }: { stamp: number }) {
  const [language, setLanguage] = useState<Language>("fr");
  const [pages, setPages] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPages(null);
    setFailed(false);
    fetchProfilePreview(language)
      .then((preview) => setPages(preview.pages))
      .catch(() => setFailed(true));
  }, [language, stamp]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label="Langue des titres" segments={languages} value={language} onChange={setLanguage} />
        <Button variant="secondary" size="sm" asChild>
          <a href={profilePreviewPdfUrl(language)} download="CV.pdf">
            <Download aria-hidden />
            Télécharger le PDF
          </a>
        </Button>
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
              key={`${language}-${stamp}-${index}`}
              src={profilePreviewPageUrl(language, index + 1, stamp)}
              label={`CV, page ${index + 1}`}
            />
          ))}
        </div>
      )}
      <p className="text-center text-xs text-text-tertiary">
        Toutes les sections du profil, sans adaptation à une offre. Les CV générés pour une offre ne gardent que
        l&apos;essentiel.
      </p>
    </div>
  );
}
