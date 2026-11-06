"use client";

import { ArrowDown, ArrowUp, CircleHelp, GripVertical, Palette, PanelTop, PenLine, Rows3, Type, type LucideIcon } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  COLOR_THEMES,
  contrastRatio,
  CV_FONTS,
  DEFAULT_COLORS,
  isHexColor,
  moveKey,
  setLabel,
  setOrder,
  toggleHidden,
  type CvColors,
  type CvLanguage,
  type CvLayout,
  type Section,
} from "@/lib/cv-layout";
import { cn } from "@/lib/utils";

export type CustomizeSection = "font" | "colors" | "header" | "sections";

/** Le menu latéral de l'espace Personnaliser. */
export const CUSTOMIZE_SECTIONS: { value: CustomizeSection; label: string; icon: LucideIcon }[] = [
  { value: "font", label: "Police", icon: Type },
  { value: "colors", label: "Couleurs", icon: Palette },
  { value: "header", label: "En-tête", icon: PanelTop },
  { value: "sections", label: "Rubriques", icon: Rows3 },
];

/** Une section de réglages, commune au CV d'une recherche et à un CV généré. */
export function LayoutControls({
  section,
  header,
  sections,
  lines,
  layout,
  language,
  onChange,
}: {
  section: CustomizeSection;
  header: { key: string; label: string }[];
  sections: Section[];
  /** Les lignes du bloc « extras », qui se masquent une à une. */
  lines: Section[];
  layout: CvLayout;
  language: CvLanguage;
  onChange: (layout: CvLayout) => void;
}) {
  const keys = sections.map((item) => item.key);
  const reorder = (order: string[]) => onChange(setOrder(layout, order));
  if (section === "font") {
    return (
      <section className="flex flex-col gap-2">
        <label htmlFor="cv-font" className="text-sm font-medium">
          Police
        </label>
        <select
          id="cv-font"
          value={layout.font ?? "Carlito"}
          onChange={(event) => onChange({ ...layout, font: event.target.value })}
          className="h-10 rounded-[12px] border border-border-strong bg-surface px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-text focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        >
          {CV_FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-text-tertiary">
          Le PDF garde toujours cette police. Dans Word, elle est remplacée si elle n&apos;est pas installée sur l&apos;ordinateur.
        </p>
      </section>
    );
  }
  if (section === "colors") {
    return (
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Couleurs</h3>
        <ColorControls colors={layout.colors ?? null} onChange={(colors) => onChange({ ...layout, colors })} />
      </section>
    );
  }
  if (section === "header") {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">En-tête</h3>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {header.map((element) => (
            <Shown
              key={element.key}
              label={element.label}
              checked={!layout.hidden.includes(element.key)}
              onChange={() => onChange(toggleHidden(layout, element.key))}
            />
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Rubriques</h3>
      <p className="text-[13px] text-text-secondary">
        Fais glisser une rubrique pour changer son ordre. Tu peux aussi lui donner ton propre nom : son rôle reste le même.
      </p>
      <Reorder.Group axis="y" values={keys} onReorder={reorder} className="flex flex-col gap-2">
        {sections.map((item, position) => (
          <SectionRow
            key={item.key}
            section={item}
            layout={layout}
            language={language}
            first={position === 0}
            last={position === sections.length - 1}
            onChange={onChange}
            onMove={(offset) => reorder(moveKey(keys, item.key, offset))}
            lines={item.key === "extras" ? lines : []}
          />
        ))}
      </Reorder.Group>
    </section>
  );
}

const COLOR_FIELDS = [
  { key: "background", label: "Fond" },
  { key: "text", label: "Texte" },
  { key: "rule", label: "Traits et puces" },
] as const;

function ColorControls({ colors, onChange }: { colors: CvColors | null; onChange: (colors: CvColors | null) => void }) {
  const current = { ...DEFAULT_COLORS, ...Object.fromEntries(Object.entries(colors ?? {}).filter(([, value]) => value)) };
  const ratio = contrastRatio(current.text, current.background);
  const same = (theme: CvColors) => COLOR_FIELDS.every(({ key }) => theme[key]?.toLowerCase() === current[key].toLowerCase());
  return (
    <>
      <div role="group" aria-label="Ensembles de couleurs" className="grid grid-cols-3 gap-2">
        {COLOR_THEMES.map((theme) => (
          <button
            key={theme.name}
            type="button"
            aria-pressed={same(theme.colors)}
            onClick={() => onChange(theme.name === "Classique" ? null : theme.colors)}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-[10px] border p-2 text-left text-xs transition-colors hover:border-border-strong",
              same(theme.colors) ? "border-text" : "border-border",
            )}
          >
            <span className="flex h-6 w-full items-center gap-1.5 rounded-md border border-border px-1.5" style={{ background: theme.colors.background }}>
              <span className="h-1 flex-1 rounded-full" style={{ background: theme.colors.text }} />
              <span className="size-2 rounded-full" style={{ background: theme.colors.rule }} />
            </span>
            {theme.name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {COLOR_FIELDS.map(({ key, label }) => (
          <ColorField key={key} label={label} value={current[key]} onChange={(value) => onChange({ ...current, [key]: value })} />
        ))}
      </div>
      {ratio < 4.5 && (
        <p role="status" className="rounded-[10px] bg-warning-soft p-2 text-xs text-warning">
          Le texte risque d&apos;être difficile à lire sur ce fond : choisis des couleurs plus contrastées.
        </p>
      )}
    </>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  // Le champ garde une saisie en cours, comme « #1F2 », tant qu'elle n'est pas une couleur complète.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        type="color"
        aria-label={`Choisir la couleur : ${label}`}
        value={value.toLowerCase()}
        onChange={(event) => {
          setDraft(null);
          onChange(event.target.value.toUpperCase());
        }}
        className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Input
        aria-label={`Code de la couleur : ${label}`}
        className="h-8 w-24 font-mono text-xs uppercase"
        maxLength={7}
        value={shown}
        error={draft !== null && !isHexColor(draft) ? " " : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (isHexColor(next)) onChange(next.toUpperCase());
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
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

