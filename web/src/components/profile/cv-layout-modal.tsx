"use client";

import { ArrowDown, ArrowUp, Check, CircleHelp, GripVertical, PenLine, RotateCcw } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tooltip } from "@/components/ui/tooltip";
import { ApiError, saveSearchLayout } from "@/lib/api";
import {
  defaultLayout,
  EXTRA_LINES,
  HEADER_ELEMENTS,
  moveKey,
  orderedSections,
  setLabel,
  setOrder,
  toggleHidden,
  type CvLanguage,
  type CvLayout,
  type Section,
} from "@/lib/cv-layout";
import { fetchProfilePreview, profilePreviewPageUrl } from "@/lib/documents";
import { cvView, type Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

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
  const keys = sections.map((section) => section.key);
  const header = HEADER_ELEMENTS.filter((element) => element.present(view, search));
  const reorder = (order: string[]) => change(setOrder(layout, order));

  return (
    <Modal
      open={open}
      onClose={close}
      size="wide"
      title="Personnaliser le CV"
      description={`Recherche « ${search.name} ». Ces choix ne changent que l'affichage : rien n'est supprimé et l'IA n'intervient pas.`}
    >
      <div className="grid gap-6 lg:h-[68dvh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-6 lg:overflow-y-auto lg:pr-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl label="Langue du CV" segments={languages} value={language} onChange={setLanguage} />
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
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">En-tête</h3>
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {header.map((element) => (
                <Shown
                  key={element.key}
                  label={element.label}
                  checked={!layout.hidden.includes(element.key)}
                  onChange={() => change(toggleHidden(layout, element.key))}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Rubriques</h3>
            <p className="text-[13px] text-text-secondary">
              Fais glisser une rubrique pour changer son ordre. Tu peux aussi lui donner ton propre nom : son rôle reste le même.
            </p>
            <Reorder.Group axis="y" values={keys} onReorder={reorder} className="flex flex-col gap-2">
              {sections.map((section, position) => (
                <SectionRow
                  key={section.key}
                  section={section}
                  layout={layout}
                  language={language}
                  first={position === 0}
                  last={position === sections.length - 1}
                  onChange={change}
                  onMove={(offset) => reorder(moveKey(keys, section.key, offset))}
                  lines={section.key === "extras" ? EXTRA_LINES.filter((line) => line.present(view)) : []}
                />
              ))}
            </Reorder.Group>
          </section>

          {error && <ErrorBanner error={error} />}
        </div>

        <Preview language={language} search={search.id} stamp={stamp} />
      </div>
      <div className="flex justify-end">
        <Button onClick={close}>Terminer</Button>
      </div>
    </Modal>
  );
}

function Shown({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  hint?: string;
}) {
  return (
    <label className="flex min-h-8 min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 text-sm transition-colors hover:bg-surface-hover">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 shrink-0 accent-[var(--text)]" aria-label={`Afficher ${label}`} />
      <span className={cn("truncate transition-colors duration-100", !checked && "text-text-tertiary line-through")}>{label}</span>
      {hint && <span className="truncate text-xs text-text-tertiary">{hint}</span>}
    </label>
  );
}

function Help({ text, name }: { text: string; name: string }) {
  return (
    <Tooltip content={<span className="block max-w-64 font-normal">{text}</span>}>
      <button type="button" aria-label={`À quoi sert « ${name} » : ${text}`} className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text">
        <CircleHelp className="size-4" aria-hidden />
      </button>
    </Tooltip>
  );
}

function Named({
  section,
  layout,
  language,
  onChange,
}: {
  section: Section;
  layout: CvLayout;
  language: CvLanguage;
  onChange: (layout: CvLayout) => void;
}) {
  const [editing, setEditing] = useState(false);
  const custom = layout.labels[section.key]?.[language] ?? "";
  const name = custom || section.names[language];
  const hidden = layout.hidden.includes(section.key);
  return (
    <>
      {editing ? (
        <Input
          aria-label={`Nom de la rubrique ${section.names[language]}`}
          autoFocus
          maxLength={80}
          className="h-8 min-w-0 flex-1 text-sm"
          placeholder={section.names[language]}
          value={custom}
          onChange={(event) => onChange(setLabel(layout, section.key, language, event.target.value))}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.stopPropagation();
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className={cn("min-w-0 flex-1 truncate text-sm transition-colors duration-100", hidden && "text-text-tertiary line-through")}>
          {name}
          {custom && <span className="ml-1.5 text-xs text-text-tertiary no-underline">({section.names[language]})</span>}
        </span>
      )}
      {!editing && (
        <button type="button" aria-label={`Renommer ${name}`} onClick={() => setEditing(true)} className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text">
          <PenLine className="size-3.5" aria-hidden />
        </button>
      )}
      <Help text={section.help} name={name} />
    </>
  );
}

function SectionRow({
  section,
  layout,
  language,
  first,
  last,
  onChange,
  onMove,
  lines,
}: {
  section: Section;
  layout: CvLayout;
  language: CvLanguage;
  first: boolean;
  last: boolean;
  onChange: (layout: CvLayout) => void;
  onMove: (offset: -1 | 1) => void;
  lines: Section[];
}) {
  const controls = useDragControls();
  const name = layout.labels[section.key]?.[language] || section.names[language];
  const toggle = (key: string) => (
    <input
      type="checkbox"
      checked={!layout.hidden.includes(key)}
      onChange={() => onChange(toggleHidden(layout, key))}
      className="size-4 shrink-0 cursor-pointer accent-[var(--text)]"
      aria-label={`Afficher ${layout.labels[key]?.[language] || (key === section.key ? section : lines.find((line) => line.key === key))?.names[language]}`}
    />
  );
  return (
    <Reorder.Item
      value={section.key}
      dragListener={false}
      dragControls={controls}
      className="rounded-[12px] border border-border bg-surface px-2 py-1.5 transition-colors hover:border-border-strong"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onPointerDown={(event) => controls.start(event)}
          className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center text-text-tertiary active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        {section.key !== "extras" && toggle(section.key)}
        <Named section={section} layout={layout} language={language} onChange={onChange} />
        <button type="button" aria-label={`Monter ${name}`} disabled={first} onClick={() => onMove(-1)} className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30">
          <ArrowUp className="size-3.5" aria-hidden />
        </button>
        <button type="button" aria-label={`Descendre ${name}`} disabled={last} onClick={() => onMove(1)} className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30">
          <ArrowDown className="size-3.5" aria-hidden />
        </button>
      </div>
      {lines.length > 0 && (
        <div className="ml-9 mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
          {lines.map((line) => (
            <div key={line.key} className="flex items-center gap-1.5">
              {toggle(line.key)}
              <Named section={line} layout={layout} language={language} onChange={onChange} />
            </div>
          ))}
        </div>
      )}
    </Reorder.Item>
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
    <div className="flex min-h-0 flex-col gap-3 rounded-[14px] bg-background-subtle p-3 lg:overflow-y-auto">
      {Array.from({ length: pages }, (_, page) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={page}
          src={profilePreviewPageUrl(language, page + 1, stamp, search)}
          alt={`Aperçu du CV, page ${page + 1}`}
          className="aspect-[210/297] w-full rounded-md bg-white shadow-card ring-1 ring-border"
        />
      ))}
    </div>
  );
}
