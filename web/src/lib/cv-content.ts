/** Le contenu d'un CV généré, tel qu'il se modifie : aligné sur le schéma du service documents. */

import { EXTRA_LINES, EXTRAS, SECTIONS, type CvLanguage, type CvLayout, type Section } from "@/lib/cv-layout";

export type CvContent = {
  language: CvLanguage;
  name: string;
  headline: string;
  show_photo?: boolean;
  contact: { text: string; url?: string | null; kind?: string | null }[];
  details: string[];
  highlight?: string | null;
  summary?: string | null;
  skills: { name: string; items: string[] }[];
  experiences: {
    title: string;
    company: string;
    location?: string | null;
    period: string;
    context?: string | null;
    groups: { title?: string | null; bullets: string[] }[];
  }[];
  education: {
    degree: string;
    school: string;
    year?: number | null;
    period?: string | null;
    location?: string | null;
    details?: string | null;
  }[];
  sections: {
    key?: string | null;
    title: string;
    entries: { title: string; meta: string[]; text?: string | null; url?: string | null }[];
    bullets: string[];
  }[];
  extras: { key?: string | null; label: string; text: string }[];
  order: string[];
  titles: Record<string, string>;
  hidden: string[];
  font?: string | null;
};

const MAIN = ["profile", "skills", "experience", "education"];

/** Les CV enregistrés avant la personnalisation n'ont ni clés ni ordre : on les leur donne. */
export function normalizeCv(content: CvContent): CvContent {
  const sections = content.sections.map((part, index) => ({ ...part, key: part.key ?? `section-${index}` }));
  const extras = content.extras.map((line, index) => ({ ...line, key: line.key ?? `line-${index}` }));
  const keys = [...MAIN, ...sections.map((part) => part.key), "extras"];
  const order = [...(content.order ?? []).filter((key) => keys.includes(key)), ...keys.filter((key) => !content.order?.includes(key))];
  return { ...content, sections, extras, order, hidden: content.hidden ?? [], titles: content.titles ?? {} };
}

export function layoutOf(content: CvContent): CvLayout {
  const labels = Object.fromEntries(Object.entries(content.titles).map(([key, title]) => [key, { [content.language]: title }]));
  return { hidden: content.hidden, order: content.order, labels, font: content.font ?? null };
}

export function withLayout(content: CvContent, layout: CvLayout): CvContent {
  const titles = Object.fromEntries(
    Object.entries(layout.labels).flatMap(([key, names]) => {
      const title = names[content.language];
      return title ? [[key, title]] : [];
    }),
  );
  return { ...content, hidden: layout.hidden, order: layout.order, titles, font: layout.font ?? null };
}

const CONTACT_HEADER: Record<string, { key: string; label: string }> = {
  location: { key: "location", label: "Ville" },
  address: { key: "address", label: "Adresse complète" },
  email: { key: "email", label: "E-mail" },
  phone: { key: "phone", label: "Téléphone" },
  github: { key: "links", label: "Liens" },
  linkedin: { key: "links", label: "Liens" },
  link: { key: "links", label: "Liens" },
  licence: { key: "licence", label: "Permis" },
  birth: { key: "birth_date", label: "Date de naissance" },
  nationality: { key: "nationality", label: "Nationalité" },
};

/** Ce que ce CV peut afficher dans son en-tête. */
export function headerElements(content: CvContent): { key: string; label: string }[] {
  const elements = content.show_photo ? [{ key: "photo", label: "Photo" }] : [];
  for (const item of content.contact) {
    const element = item.kind ? CONTACT_HEADER[item.kind] : undefined;
    if (element && !elements.some((other) => other.key === element.key)) elements.push(element);
  }
  if (content.highlight) elements.push({ key: "availability", label: "Disponibilité" });
  if (content.details.length) elements.push({ key: "contracts", label: "Contrats recherchés" });
  return elements;
}

/** Le nom d'une coordonnée dans le formulaire. */
export function contactLabel(item: CvContent["contact"][number]) {
  const element = item.kind ? CONTACT_HEADER[item.kind] : undefined;
  if (!element) return "Coordonnée";
  return element.key === "links" ? "Lien" : element.label;
}

const always = () => true;

function hasContent(content: CvContent, key: string) {
  if (key === "profile") return Boolean(content.summary);
  if (key === "skills") return content.skills.length > 0;
  if (key === "experience") return content.experiences.length > 0;
  if (key === "education") return content.education.length > 0;
  if (key === "extras") return content.extras.length > 0;
  return content.sections.some((part) => part.key === key);
}

/** Les rubriques de ce CV, dans son ordre, avec leur rôle. */
export function contentSections(content: CvContent): Section[] {
  return content.order
    .filter((key) => hasContent(content, key))
    .map((key) => {
      const known = [...SECTIONS, EXTRAS].find((section) => section.key === key);
      if (known) return known;
      const title = content.sections.find((part) => part.key === key)?.title ?? key;
      return { key, names: { fr: title, en: title }, help: "Une section libre de ce CV.", present: always };
    });
}

export function contentLines(content: CvContent): Section[] {
  return content.extras.map((line) => {
    const known = EXTRA_LINES.find((item) => item.key === line.key);
    return known ?? { key: line.key ?? line.label, names: { fr: line.label, en: line.label }, help: "Une ligne de fin de CV.", present: always };
  });
}

/** Retire ce que l'éditeur laisse de vide : lignes de réalisations sans texte, thèmes sans rien. */
export function cleanCv(content: CvContent): CvContent {
  const lines = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
  return {
    ...content,
    skills: content.skills.map((skill) => ({ ...skill, items: lines(skill.items) })).filter((skill) => skill.name.trim() && skill.items.length),
    experiences: content.experiences.map((experience) => ({
      ...experience,
      groups: experience.groups
        .map((group) => ({ ...group, bullets: lines(group.bullets) }))
        .filter((group) => group.title?.trim() || group.bullets.length),
    })),
    sections: content.sections.map((part) => ({ ...part, bullets: lines(part.bullets) })),
  };
}

/**
 * Met en gras la sélection, ou le retire si elle l'est déjà. Chaque ligne est traitée à part : une
 * réalisation reste une ligne. Les espaces autour de la sélection restent hors du gras.
 */
export function toggleBold(text: string, start: number, end: number): { text: string; start: number; end: number } {
  if (start === end) return { text, start, end };
  const before = text.slice(0, start);
  const after = text.slice(end);
  const selected = text.slice(start, end);
  const wrapped = before.endsWith("**") && after.startsWith("**");
  if (wrapped) {
    const next = before.slice(0, -2) + selected + after.slice(2);
    return { text: next, start: start - 2, end: end - 2 };
  }
  const replaced = selected
    .split("\n")
    .map((line) => {
      const inner = line.trim();
      if (!inner) return line;
      const bare = inner.startsWith("**") && inner.endsWith("**") && inner.length > 4 ? inner.slice(2, -2) : `**${inner}**`;
      return line.replace(inner, () => bare);
    })
    .join("\n");
  return { text: before + replaced + after, start, end: start + replaced.length };
}
