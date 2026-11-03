/** L'affichage du CV d'une recherche : ce qui se voit, l'ordre des rubriques et leur nom. */

import type { CvColors, CvLayout, CvView, SearchProfile } from "@/lib/profile";

export type { CvColors, CvLayout };

export type CvLanguage = "fr" | "en";

/** Les polices embarquées. Les plus connues sont des équivalents libres, de mêmes dimensions. */
export const CV_FONTS = [
  { value: "Carlito", label: "Calibri (Carlito)" },
  { value: "Arimo", label: "Arial (Arimo)" },
  { value: "Tinos", label: "Times New Roman (Tinos)" },
  { value: "Caladea", label: "Cambria (Caladea)" },
  { value: "Gelasio", label: "Georgia (Gelasio)" },
  { value: "EB Garamond", label: "Garamond (EB Garamond)" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
];

export const DEFAULT_COLORS = { background: "#FFFFFF", text: "#1F1F1F", rule: "#FFC412" };

/** Des ensembles prêts à l'emploi : ils restent modifiables couleur par couleur. */
export const COLOR_THEMES: { name: string; colors: Required<{ [K in keyof CvColors]: string }> }[] = [
  { name: "Classique", colors: DEFAULT_COLORS },
  { name: "Crème", colors: { background: "#FBF7EF", text: "#1F1F1F", rule: "#FFC412" } },
  { name: "Bleu nuit", colors: { background: "#FFFFFF", text: "#1F2A44", rule: "#2F6FED" } },
  { name: "Forêt", colors: { background: "#FFFFFF", text: "#1E3A2F", rule: "#2E7D5B" } },
  { name: "Bordeaux", colors: { background: "#FFFFFF", text: "#3A1A22", rule: "#9B2C42" } },
  { name: "Sombre", colors: { background: "#1F1F1F", text: "#F5F5F5", rule: "#FFC412" } },
];

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Le contraste entre deux couleurs, selon le calcul WCAG : de 1 (identiques) à 21. */
export function contrastRatio(first: string, second: string) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** Facultatifs sur un CV : affichés seulement si la personne le demande. */
export const HIDDEN_BY_DEFAULT = ["address", "birth_date", "nationality", "referees"];

export function defaultLayout(): CvLayout {
  return { hidden: [...HIDDEN_BY_DEFAULT], order: [], labels: {}, font: null, colors: null };
}

type Element = { key: string; label: string; present: (view: CvView, search: SearchProfile) => boolean };

/** Ce qui peut s'afficher dans l'en-tête. Sans valeur dans le profil, l'élément n'est pas proposé. */
export const HEADER_ELEMENTS: Element[] = [
  { key: "photo", label: "Photo", present: () => true },
  { key: "location", label: "Ville", present: ({ identity }) => Boolean(identity.location) },
  { key: "address", label: "Adresse complète", present: ({ identity }) => Boolean(identity.address) },
  { key: "email", label: "E-mail", present: ({ identity }) => Boolean(identity.email) },
  { key: "phone", label: "Téléphone", present: ({ identity }) => Boolean(identity.phone) },
  { key: "links", label: "Liens", present: ({ identity }) => identity.links.length > 0 },
  { key: "licence", label: "Permis", present: ({ identity }) => Boolean(identity.driving_licence) },
  { key: "birth_date", label: "Date de naissance", present: ({ identity }) => Boolean(identity.birth_date) },
  { key: "nationality", label: "Nationalité", present: ({ identity }) => Boolean(identity.nationality) },
  { key: "availability", label: "Disponibilité", present: ({ identity }) => Boolean(identity.availability) },
  { key: "contracts", label: "Contrats recherchés", present: (_, search) => search.contract_types.length > 0 },
];

export type Section = {
  key: string;
  /** Le nom par défaut, par langue du CV. */
  names: Record<CvLanguage, string>;
  /** Le rôle de la rubrique : il reste le même quel que soit son nom. */
  help: string;
  present: (view: CvView) => boolean;
};

export const SECTIONS: Section[] = [
  { key: "profile", names: { fr: "Profil", en: "Profile" }, help: "Le résumé de ton parcours et de ce que tu apportes, en quelques phrases.", present: (view) => Boolean(view.identity.summary) },
  { key: "skills", names: { fr: "Compétences", en: "Skills" }, help: "Ce que tu sais faire et les outils que tu maîtrises, par catégorie.", present: (view) => view.skills.length > 0 },
  { key: "experience", names: { fr: "Expérience professionnelle", en: "Professional experience" }, help: "Les postes occupés, avec leurs dates et tes réalisations.", present: (view) => view.experiences.length > 0 },
  { key: "education", names: { fr: "Formation", en: "Education" }, help: "Tes diplômes et tes études.", present: (view) => view.education.length > 0 },
  { key: "projects", names: { fr: "Projets", en: "Projects" }, help: "Les projets personnels, associatifs ou d'études qui montrent ce que tu sais faire.", present: (view) => view.projects.length > 0 },
  { key: "certifications", names: { fr: "Certifications", en: "Certifications" }, help: "Les certifications et titres obtenus auprès d'un organisme.", present: (view) => view.certifications.length > 0 },
  { key: "volunteering", names: { fr: "Bénévolat", en: "Volunteering" }, help: "Tes engagements bénévoles ou associatifs.", present: (view) => view.volunteering.length > 0 },
  { key: "publications", names: { fr: "Publications", en: "Publications" }, help: "Les articles, livres ou travaux que tu as publiés.", present: (view) => view.publications.length > 0 },
  { key: "courses", names: { fr: "Formations suivies", en: "Courses" }, help: "Les formations courtes suivies en dehors de tes diplômes.", present: (view) => view.courses.length > 0 },
  { key: "awards", names: { fr: "Récompenses", en: "Awards" }, help: "Les prix et distinctions que tu as reçus.", present: (view) => view.awards.length > 0 },
  { key: "referees", names: { fr: "Références", en: "References" }, help: "Les personnes qui peuvent recommander ton travail. Demande-leur leur accord avant.", present: (view) => view.referees.length > 0 },
];

export const EXTRAS: Section = {
  key: "extras",
  names: { fr: "Informations complémentaires", en: "Additional information" },
  help: "Le bloc de fin de CV : langues, qualités et centres d'intérêt.",
  present: (view) => EXTRA_LINES.some((line) => line.present(view)),
};

/** Les lignes du bloc de fin. Chacune se masque et se renomme à part. */
export const EXTRA_LINES: Section[] = [
  { key: "languages", names: { fr: "Langues", en: "Languages" }, help: "Les langues que tu parles et ton niveau. Communes à tous tes CV.", present: (view) => view.languages.length > 0 },
  { key: "soft_skills", names: { fr: "Qualités", en: "Soft skills" }, help: "Tes qualités personnelles et ta façon de travailler.", present: (view) => view.soft_skills.length > 0 },
  { key: "interests", names: { fr: "Centres d'intérêt", en: "Interests" }, help: "Tes activités en dehors du travail.", present: (view) => view.interests.length > 0 },
];

function customSections(view: CvView): Section[] {
  return view.custom_sections
    .filter((section) => section.title.trim())
    .map((section) => ({
      key: `custom:${section.title}`,
      names: { fr: section.title, en: section.title },
      help: "Une section libre que tu as créée dans ton parcours.",
      present: () => section.items.length > 0,
    }));
}

/** Les rubriques de ce CV, dans l'ordre choisi. Une rubrique sans contenu n'est pas proposée. */
export function orderedSections(view: CvView, layout: CvLayout): Section[] {
  const all = [...SECTIONS, ...customSections(view), EXTRAS];
  const chosen = layout.order.flatMap((key) => all.find((section) => section.key === key) ?? []);
  const rest = all.filter((section) => !layout.order.includes(section.key));
  return [...chosen, ...rest].filter((section) => section.present(view));
}

export function toggleHidden(layout: CvLayout, key: string): CvLayout {
  const hidden = layout.hidden.includes(key) ? layout.hidden.filter((item) => item !== key) : [...layout.hidden, key];
  return { ...layout, hidden };
}

export function setOrder(layout: CvLayout, order: string[]): CvLayout {
  return { ...layout, order };
}

/** Déplace une rubrique d'un cran. Renvoie le même ordre si elle est déjà au bord. */
export function moveKey(order: string[], key: string, offset: -1 | 1): string[] {
  const from = order.indexOf(key);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
}

/** Le nom choisi pour cette langue. Un nom vide rend le nom par défaut. */
export function setLabel(layout: CvLayout, key: string, language: CvLanguage, value: string): CvLayout {
  const current = { ...layout.labels[key], [language]: value.trim() ? value : null };
  const labels = { ...layout.labels };
  if (current.fr || current.en) labels[key] = current;
  else delete labels[key];
  return { ...layout, labels };
}
