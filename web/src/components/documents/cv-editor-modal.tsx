"use client";

import { Bold, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LayoutControls } from "@/components/profile/cv-layout-controls";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  cleanCv,
  contactLabel,
  contentLines,
  contentSections,
  headerElements,
  layoutOf,
  normalizeCv,
  toggleBold,
  withLayout,
  type CvContent,
} from "@/lib/cv-content";
import { fetchCv, previewCv, saveCv, type DocumentInfo } from "@/lib/documents";

type Tab = "content" | "layout";
const tabs: { value: Tab; label: string }[] = [
  { value: "content", label: "Contenu" },
  { value: "layout", label: "Affichage" },
];
const PREVIEW_DELAY = 400;

/** Modifie un CV généré : son texte, son gras, son affichage et sa police, avec l'aperçu à côté. */
export function CvEditorModal({
  document,
  onSaved,
  onClose,
}: {
  document: DocumentInfo;
  onSaved: (document: DocumentInfo) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState<CvContent | null>(null);
  const [initial, setInitial] = useState("");
  const [tab, setTab] = useState<Tab>("content");
  const [pages, setPages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const request = useRef(0);

  useEffect(() => {
    fetchCv(document.id)
      .then((loaded) => {
        const normalized = normalizeCv(loaded);
        setContent(normalized);
        setInitial(JSON.stringify(cleanCv(normalized)));
      })
      .catch((e: ApiError) => setError(e));
  }, [document.id]);

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
  const update = (recipe: (draft: CvContent) => void) =>
    setContent((previous) => {
      if (!previous) return previous;
      const draft = structuredClone(previous);
      recipe(draft);
      return draft;
    });

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
    <Modal
      open
      onClose={close}
      size="wide"
      title="Modifier le CV"
      description="Ces modifications ne concernent que ce CV : ton profil et tes autres CV ne changent pas."
    >
      <div className="grid gap-6 lg:h-[64dvh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-5 lg:overflow-y-auto lg:pr-2">
          <SegmentedControl label="Partie à modifier" segments={tabs} value={tab} onChange={setTab} />
          {!content ? (
            <Skeleton className="h-96" />
          ) : tab === "content" ? (
            <ContentForm content={content} update={update} />
          ) : (
            <LayoutControls
              header={headerElements(content)}
              sections={contentSections(content)}
              lines={contentLines(content)}
              layout={layoutOf(content)}
              language={content.language}
              onChange={(layout) => setContent(withLayout(content, layout))}
            />
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-3 rounded-[14px] bg-background-subtle p-3 lg:overflow-y-auto">
          {pages.length === 0 ? (
            <Skeleton className="aspect-[210/297] w-full rounded-md" />
          ) : (
            pages.map((page, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={index} src={page} alt={`Aperçu du CV, page ${index + 1}`} className="aspect-[210/297] w-full rounded-md bg-white shadow-card ring-1 ring-border" />
            ))
          )}
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      {leaving ? (
        <div className="flex flex-wrap items-center justify-end gap-2" role="alert">
          <span className="mr-auto text-sm text-text-secondary">Tes modifications ne sont pas enregistrées.</span>
          <Button variant="ghost" onClick={onClose}>
            Fermer sans enregistrer
          </Button>
          <Button variant="secondary" onClick={() => setLeaving(false)}>
            Continuer
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Check aria-hidden />
            Enregistrer
          </Button>
        </div>
      )}
    </Modal>
  );
}

/** Un champ de texte avec son bouton gras, qui agit sur le passage sélectionné. */
function RichField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const bold = () => {
    const element = field.current;
    if (!element) return;
    const next = toggleBold(value, element.selectionStart, element.selectionEnd);
    onChange(next.text);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(next.start, next.end);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{label}</span>
        <button
          type="button"
          aria-label={`Mettre en gras dans ${label}`}
          title="Sélectionne un passage, puis clique pour le mettre en gras"
          // Le champ garde sa sélection : le bouton ne doit pas prendre le focus au clic.
          onMouseDown={(event) => event.preventDefault()}
          onClick={bold}
          className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
        >
          <Bold className="size-3.5" aria-hidden />
        </button>
      </div>
      <Textarea ref={field} aria-label={label} className="min-h-20" value={value} onChange={(event) => onChange(event.target.value)} hint={hint} />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-background-subtle p-3">{children}</div>;
}

function ContentForm({ content, update }: { content: CvContent; update: (recipe: (draft: CvContent) => void) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-text-tertiary">Pour mettre en gras : sélectionne un passage, puis clique sur le B. Il s&apos;écrit **ainsi** dans le champ.</p>

      <Block title="En-tête">
        <Input label="Titre" value={content.headline} onChange={(event) => update((draft) => void (draft.headline = event.target.value))} />
        {content.contact.map((item, index) => (
          <Input
            key={`${item.kind}-${index}`}
            label={contactLabel(item)}
            value={item.text}
            onChange={(event) => update((draft) => void (draft.contact[index].text = event.target.value))}
          />
        ))}
      </Block>

      <Block title="Profil">
        <RichField label="Résumé" value={content.summary ?? ""} onChange={(value) => update((draft) => void (draft.summary = value))} />
      </Block>

      {content.skills.length > 0 && (
        <Block title="Compétences">
          {content.skills.map((skill, index) => (
            <Panel key={index}>
              <Input label="Catégorie" value={skill.name} onChange={(event) => update((draft) => void (draft.skills[index].name = event.target.value))} />
              <RichField
                label={`Éléments de ${skill.name || "la catégorie"}`}
                hint="Un élément par ligne."
                value={skill.items.join("\n")}
                onChange={(value) => update((draft) => void (draft.skills[index].items = value.split("\n")))}
              />
            </Panel>
          ))}
        </Block>
      )}

      {content.experiences.length > 0 && (
        <Block title="Expériences">
          {content.experiences.map((experience, index) => (
            <Panel key={index}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Poste" value={experience.title} onChange={(event) => update((draft) => void (draft.experiences[index].title = event.target.value))} />
                <Input label="Dates" value={experience.period} onChange={(event) => update((draft) => void (draft.experiences[index].period = event.target.value))} />
                <Input label="Entreprise" value={experience.company} onChange={(event) => update((draft) => void (draft.experiences[index].company = event.target.value))} />
                <Input label="Lieu" value={experience.location ?? ""} onChange={(event) => update((draft) => void (draft.experiences[index].location = event.target.value || null))} />
              </div>
              <RichField label={`Contexte de ${experience.title || "ce poste"}`} value={experience.context ?? ""} onChange={(value) => update((draft) => void (draft.experiences[index].context = value || null))} />
              {experience.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="flex flex-col gap-2">
                  <Input
                    label="Thème"
                    value={group.title ?? ""}
                    onChange={(event) => update((draft) => void (draft.experiences[index].groups[groupIndex].title = event.target.value || null))}
                  />
                  <RichField
                    label={`Réalisations ${group.title ? `de ${group.title}` : `du thème ${groupIndex + 1}`}`}
                    hint="Une réalisation par ligne."
                    value={group.bullets.join("\n")}
                    onChange={(value) => update((draft) => void (draft.experiences[index].groups[groupIndex].bullets = value.split("\n")))}
                  />
                </div>
              ))}
            </Panel>
          ))}
        </Block>
      )}

      {content.education.length > 0 && (
        <Block title="Formation">
          {content.education.map((item, index) => (
            <Panel key={index}>
              <Input label="Diplôme" value={item.degree} onChange={(event) => update((draft) => void (draft.education[index].degree = event.target.value))} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="École" value={item.school} onChange={(event) => update((draft) => void (draft.education[index].school = event.target.value))} />
                <Input label="Lieu" value={item.location ?? ""} onChange={(event) => update((draft) => void (draft.education[index].location = event.target.value || null))} />
                <Input label="Dates" value={item.period ?? ""} onChange={(event) => update((draft) => void (draft.education[index].period = event.target.value || null))} />
              </div>
              <RichField label={`Détails de ${item.degree || "la formation"}`} value={item.details ?? ""} onChange={(value) => update((draft) => void (draft.education[index].details = value || null))} />
            </Panel>
          ))}
        </Block>
      )}

      {content.sections.map((part, index) => (
        <Block key={part.key ?? index} title={content.titles[part.key ?? ""] ?? part.title}>
          {part.entries.map((entry, entryIndex) => (
            <Panel key={entryIndex}>
              <Input label="Intitulé" value={entry.title} onChange={(event) => update((draft) => void (draft.sections[index].entries[entryIndex].title = event.target.value))} />
              <Input
                label="Précisions"
                value={entry.meta.join(" · ")}
                onChange={(event) =>
                  update((draft) => void (draft.sections[index].entries[entryIndex].meta = event.target.value ? event.target.value.split(" · ") : []))
                }
              />
              <RichField label={`Description de ${entry.title || "cet élément"}`} value={entry.text ?? ""} onChange={(value) => update((draft) => void (draft.sections[index].entries[entryIndex].text = value || null))} />
            </Panel>
          ))}
          {part.bullets.length > 0 && (
            <RichField
              label={`Contenu de ${part.title}`}
              hint="Un élément par ligne."
              value={part.bullets.join("\n")}
              onChange={(value) => update((draft) => void (draft.sections[index].bullets = value.split("\n")))}
            />
          )}
        </Block>
      ))}

      {content.extras.length > 0 && (
        <Block title="Informations complémentaires">
          {content.extras.map((line, index) => (
            <RichField
              key={line.key ?? index}
              label={content.titles[line.key ?? ""] ?? line.label}
              value={line.text}
              onChange={(value) => update((draft) => void (draft.extras[index].text = value))}
            />
          ))}
        </Block>
      )}
    </div>
  );
}
