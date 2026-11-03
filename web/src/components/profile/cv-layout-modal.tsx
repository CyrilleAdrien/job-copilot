"use client";

import { Check, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CvWorkspace } from "@/components/documents/cv-workspace";
import { LayoutControls } from "@/components/profile/cv-layout-controls";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ApiError, saveSearchLayout } from "@/lib/api";
import {
  defaultLayout,
  EXTRA_LINES,
  HEADER_ELEMENTS,
  orderedSections,
  type CvLanguage,
  type CvLayout,
} from "@/lib/cv-layout";
import { fetchProfilePreview, profilePreviewPageUrl } from "@/lib/documents";
import { cvView, type Profile } from "@/lib/profile";

const languages: { value: CvLanguage; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];
const SAVE_DELAY = 400;

/** Choisit ce que montre le CV d'une recherche. Rien ne passe par l'IA : seul le rendu change. */
export function CvLayoutModal({
  open,
  onClose,
  profile,
  index,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  index: number;
  onSaved: (profile: Profile) => void;
}) {
  const search = profile.searches[index];
  const [layout, setLayout] = useState<CvLayout>(search.cv_layout);
  const [language, setLanguage] = useState<CvLanguage>("fr");
  const [stamp, setStamp] = useState(() => Date.now());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<CvLayout | null>(null);
  const request = useRef(0);

  const save = useCallback(async () => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    const current = ++request.current;
    try {
      const updated = await saveSearchLayout(search.id, next);
      // Une réponse dépassée par un choix plus récent ne doit pas l'écraser.
      if (current !== request.current) return;
      onSaved(updated);
      setStamp(Date.now());
      setSaved(true);
      setError(null);
    } catch (e) {
      if (current === request.current) setError(e instanceof ApiError ? e : new ApiError("Enregistrement impossible.", 0));
    }
  }, [onSaved, search.id]);

  const change = (next: CvLayout) => {
    setLayout(next);
    setSaved(false);
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY);
  };

  // En fermant, le dernier choix part tout de suite.
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    void save();
    onClose();
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const view = cvView(profile, index);
  const sections = orderedSections(view, layout);
  const header = HEADER_ELEMENTS.filter((element) => element.present(view, search));

  return (
    <Modal
      open={open}
      onClose={close}
      size="full"
      title="Personnaliser le CV"
      description={`Recherche « ${search.name} ». Seul l'affichage change : rien n'est supprimé et l'IA n'intervient pas.`}
      actions={
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-success" role="status">
              <Check className="size-3.5" aria-hidden />
              Enregistré
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => change(defaultLayout())}>
            <RotateCcw aria-hidden />
            Réinitialiser
          </Button>
          <Button size="sm" onClick={close}>
            Terminer
          </Button>
        </div>
      }
    >
      <CvWorkspace
        panel={
          <>
            <SegmentedControl label="Langue du CV" segments={languages} value={language} onChange={setLanguage} />
            <LayoutControls
              header={header}
              sections={sections}
              lines={EXTRA_LINES.filter((line) => line.present(view))}
              layout={layout}
              language={language}
              onChange={change}
            />
            {error && <ErrorBanner error={error} />}
          </>
        }
      >
        <Preview language={language} search={search.id} stamp={stamp} />
      </CvWorkspace>
    </Modal>
  );
}

/** L'aperçu garde l'ancienne image jusqu'à l'arrivée de la nouvelle : il ne clignote pas. */
function Preview({ language, search, stamp }: { language: CvLanguage; search: string; stamp: number }) {
  const [pages, setPages] = useState(1);
  useEffect(() => {
    fetchProfilePreview(language, search)
      .then((preview) => setPages(preview.pages))
      .catch(() => undefined);
  }, [language, search, stamp]);
  return (
    <>
      {Array.from({ length: pages }, (_, page) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={page}
          src={profilePreviewPageUrl(language, page + 1, stamp, search)}
          alt={`Aperçu du CV, page ${page + 1}`}
          className="aspect-[210/297] w-full rounded-md bg-white shadow-card ring-1 ring-border"
        />
      ))}
    </>
  );
}
