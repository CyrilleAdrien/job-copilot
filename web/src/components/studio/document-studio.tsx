"use client";

import { Check, FileText, RotateCcw, SlidersHorizontal, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EditorRevision } from "@/components/documents/rich-editor";
import { CUSTOMIZE_SECTIONS, LayoutControls, type CustomizeSection } from "@/components/profile/cv-layout-controls";
import { ErrorBanner } from "@/components/profile/error-banner";
import { CvContentForm } from "@/components/studio/cv-content-form";
import { CvStudio, StudioNavigation, type StudioTab } from "@/components/studio/cv-studio";
import { useHistory } from "@/components/studio/use-history";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { cleanCv, contentLines, contentSections, headerElements, layoutOf, normalizeCv, withLayout, type CvContent } from "@/lib/cv-content";
import { fetchCv, pdfUrl, previewCv, saveCv, wordUrl, type DocumentInfo, type GenerationWarning } from "@/lib/documents";

type Tab = "content" | "customize" | "ai";
const TABS: StudioTab<Tab>[] = [
  { value: "content", label: "Contenu", icon: FileText },
  { value: "customize", label: "Personnaliser", icon: SlidersHorizontal },
  { value: "ai", label: "IA", icon: Sparkles },
];
const PREVIEW_DELAY = 400;

/** Modifie un CV généré : son texte, son affichage, sa police et ses couleurs. */
export function DocumentStudio({
  document,
  warnings,
  onSaved,
  onRegenerate,
  onClose,
}: {
  document: DocumentInfo;
  warnings: GenerationWarning[];
  onSaved: (document: DocumentInfo) => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const history = useHistory<CvContent | null>(null);
  const content = history.present;
  const [initial, setInitial] = useState("");
  const [tab, setTab] = useState<Tab>("content");
  const [section, setSection] = useState<CustomizeSection>("font");
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const request = useRef(0);
  const { reset } = history;

  useEffect(() => {
    fetchCv(document.id)
      .then((loaded) => {
        const normalized = normalizeCv(loaded);
        reset(normalized);
        setInitial(JSON.stringify(cleanCv(normalized)));
      })
      .catch((e: ApiError) => setError(e));
  }, [document.id, reset]);

  // L'aperçu suit la saisie, sans rien enregistrer. Une réponse dépassée est ignorée.
  useEffect(() => {
    if (!content) return;
    const current = ++request.current;
    const timer = setTimeout(() => {
      previewCv(document.id, cleanCv(content))
        .then((images) => {
          if (current === request.current) {
            setPages(images);
            setError(null);
          }
        })
        .catch((e: ApiError) => {
          if (current === request.current) setError(e);
        });
    }, PREVIEW_DELAY);
    return () => clearTimeout(timer);
  }, [content, document.id]);

  const dirty = content !== null && JSON.stringify(cleanCv(content)) !== initial;
  const update = (recipe: (draft: CvContent) => void) => {
    if (!content) return;
    const draft = structuredClone(content);
    recipe(draft);
    history.set(draft, "contenu");
  };

  const close = () => (dirty ? setLeaving(true) : onClose());

  async function save() {
    if (!content) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveCv(document.id, cleanCv(content)));
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Enregistrement impossible.", 0));
      setSaving(false);
    }
  }

  return (
    <CvStudio
      title="Modifier le CV"
      onClose={close}
      tabs={TABS}
      tab={tab}
      onTab={setTab}
      downloads={dirty ? null : { pdf: pdfUrl(document), word: wordUrl(document) }}
      history={history}
      navigation={
        tab === "customize" ? <StudioNavigation label="Réglages du CV" items={CUSTOMIZE_SECTIONS} value={section} onChange={setSection} /> : undefined
      }
      actions={
        leaving ? (
          <div className="flex flex-wrap items-center gap-2" role="alert">
            <span className="text-sm text-text-secondary">Tes modifications ne sont pas enregistrées.</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fermer sans enregistrer
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setLeaving(false)}>
              Continuer
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={save} loading={saving} disabled={!dirty}>
            <Check aria-hidden />
            Enregistrer
          </Button>
        )
      }
      panel={
        <>
          {error && <ErrorBanner error={error} />}
          {!content ? (
            <Skeleton className="h-96" />
          ) : tab === "content" ? (
            <EditorRevision.Provider value={history.revision}>
              <CvContentForm content={content} update={update} />
            </EditorRevision.Provider>
          ) : tab === "customize" ? (
            <LayoutControls
              section={section}
              header={headerElements(content)}
              sections={contentSections(content)}
              lines={contentLines(content)}
              layout={layoutOf(content)}
              language={content.language}
              onChange={(layout) => history.set(withLayout(content, layout), "affichage")}
            />
          ) : (
            <AiPanel warnings={warnings} onRegenerate={onRegenerate} />
          )}
        </>
      }
      preview={
        pages.length === 0 ? (
          <Skeleton className="aspect-[210/297] w-full rounded-md" />
        ) : (
          pages.map((page, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={page} alt={`Aperçu du CV, page ${index + 1}`} className="aspect-[210/297] w-full rounded-md bg-white shadow-card ring-1 ring-border" />
          ))
        )
      }
    />
  );
}

function AiPanel({ warnings, onRegenerate }: { warnings: GenerationWarning[]; onRegenerate: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">À vérifier avant d&apos;envoyer</h3>
        {warnings.length === 0 ? (
          <p className="text-sm text-text-secondary">Le contrôle de la génération n&apos;a rien relevé.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {warnings.map((warning) => (
              <li key={`${warning.text}-${warning.reason}`} className="flex gap-2 rounded-[10px] bg-warning-soft p-2.5 text-[13px]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span className="text-text-secondary">
                  « {warning.text} » : {warning.reason}.
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-text-tertiary">Ce contrôle porte sur le texte généré, pas sur tes propres modifications.</p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Nouvelle version</h3>
        <p className="text-sm text-text-secondary">L&apos;IA rédige de nouveau ce CV à partir de l&apos;offre. Tes modifications de cette version resteront dans son historique.</p>
        <Button variant="secondary" size="sm" className="w-fit" onClick={onRegenerate}>
          <RotateCcw aria-hidden />
          Générer une nouvelle version
        </Button>
      </section>
    </div>
  );
}
