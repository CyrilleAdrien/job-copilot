"use client";

import { Check, FileText, PenLine, RotateCcw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CUSTOMIZE_SECTIONS, LayoutControls, type CustomizeSection } from "@/components/profile/cv-layout-controls";
import { ErrorBanner } from "@/components/profile/error-banner";
import { CvSelector, CvStudio, StudioNavigation, type StudioTab } from "@/components/studio/cv-studio";
import { useHistory } from "@/components/studio/use-history";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ApiError, saveSearchLayout } from "@/lib/api";
import { defaultLayout, EXTRA_LINES, HEADER_ELEMENTS, orderedSections, type CvLanguage, type CvLayout } from "@/lib/cv-layout";
import { fetchProfilePreview, profilePreviewPageUrl, profilePreviewPdfUrl, profilePreviewWordUrl } from "@/lib/documents";
import { cvView, type Profile } from "@/lib/profile";

type Tab = "content" | "customize";
const TABS: StudioTab<Tab>[] = [
  { value: "content", label: "Contenu", icon: FileText },
  { value: "customize", label: "Personnaliser", icon: SlidersHorizontal },
];
const languages: { value: CvLanguage; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];
const SAVE_DELAY = 400;

/** Le CV d'une recherche. Chaque recherche a son historique : on repart de zéro en changeant de CV. */
export function SearchStudio({
  profile,
  index,
  onIndex,
  onSaved,
  onClose,
}: {
  profile: Profile;
  index: number;
  onIndex: (index: number) => void;
  onSaved: (profile: Profile) => void;
  onClose: () => void;
}) {
  return <Studio key={profile.searches[index].id} profile={profile} index={index} onIndex={onIndex} onSaved={onSaved} onClose={onClose} />;
}

function Studio({
  profile,
  index,
  onIndex,
  onSaved,
  onClose,
}: {
  profile: Profile;
  index: number;
  onIndex: (index: number) => void;
  onSaved: (profile: Profile) => void;
  onClose: () => void;
}) {
  const search = profile.searches[index];
  const history = useHistory<CvLayout>(search.cv_layout);
  const layout = history.present;
  const [tab, setTab] = useState<Tab>("customize");
  const [section, setSection] = useState<CustomizeSection>("font");
  const [language, setLanguage] = useState<CvLanguage>("fr");
  const [stamp, setStamp] = useState(() => Date.now());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const request = useRef(0);
  const lastSaved = useRef(search.cv_layout);
  const latest = useRef(layout);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    const next = latest.current;
    if (next === lastSaved.current) return;
    lastSaved.current = next;
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

  // Tout changement part tout seul, y compris annuler et rétablir.
  useEffect(() => {
    latest.current = layout;
    if (layout === lastSaved.current) return;
    setSaved(false);
    timer.current = setTimeout(save, SAVE_DELAY);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [layout, save]);

  // En fermant ou en changeant de CV, le dernier choix part tout de suite.
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    void save();
  };

  const view = cvView(profile, index);
  const sections = orderedSections(view, layout);
  const header = HEADER_ELEMENTS.filter((element) => element.present(view, search));
  const active = profile.searches.flatMap((item, position) => (item.archived ? [] : [{ value: position, label: item.name }]));

  return (
    <CvStudio
      title="Personnaliser le CV"
      onClose={() => {
        flush();
        onClose();
      }}
      tabs={TABS}
      tab={tab}
      onTab={setTab}
      history={history}
      downloads={{ pdf: profilePreviewPdfUrl(language, search.id), word: profilePreviewWordUrl(language, search.id) }}
      selector={
        <CvSelector
          options={active}
          value={index}
          onChange={(next) => {
            flush();
            onIndex(next);
          }}
        />
      }
      status={
        saved && (
          <span className="inline-flex items-center gap-1 text-xs text-success" role="status">
            <Check className="size-3.5" aria-hidden />
            Enregistré
          </span>
        )
      }
      navigation={
        tab === "customize" ? <StudioNavigation label="Réglages du CV" items={CUSTOMIZE_SECTIONS} value={section} onChange={setSection} /> : undefined
      }
      panel={
        tab === "content" ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Le contenu de ce CV</h3>
            <p className="text-sm text-text-secondary">
              Titre, résumé, expériences, compétences et parcours de la recherche « {search.name} » se modifient dans ton profil.
            </p>
            <Button variant="secondary" size="sm" className="w-fit" asChild>
              <Link href={`/bienvenue?cv=${encodeURIComponent(search.id)}`}>
                <PenLine aria-hidden />
                Modifier le contenu
              </Link>
            </Button>
          </section>
        ) : (
          <>
            <SegmentedControl label="Langue du CV" segments={languages} value={language} onChange={setLanguage} />
            <LayoutControls
              section={section}
              header={header}
              sections={sections}
              lines={EXTRA_LINES.filter((line) => line.present(view))}
              layout={layout}
              language={language}
              onChange={(next) => history.set(next, "affichage")}
            />
            {error && <ErrorBanner error={error} />}
            <Button variant="ghost" size="sm" className="mt-auto w-fit" onClick={() => history.set(defaultLayout())}>
              <RotateCcw aria-hidden />
              Réinitialiser
            </Button>
          </>
        )
      }
      preview={<Preview language={language} search={search.id} stamp={stamp} />}
    />
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
