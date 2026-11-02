/** Types du profil, alignés sur le schéma Pydantic du service profile. */

export type Seniority = "graduate" | "mid" | "senior" | "lead";
export type ContractType = "cdi" | "cdd" | "freelance" | "alternance" | "stage";
export type RemotePolicy = "onsite" | "hybrid" | "remote" | "any";
export type MaxAgeDays = 1 | 3 | 7 | 14 | 30;
export type MatchMode = "domain" | "skills";

export type Link = { label: string; url: string };
export type ExperienceGroup = { title?: string | null; bullets: string[] };
export type Experience = {
  title: string;
  company: string;
  location?: string | null;
  contract?: string | null;
  start: string;
  end?: string | null;
  context?: string | null;
  groups: ExperienceGroup[];
  technologies: string[];
};
export type Education = { degree: string; school: string; year?: number | null; details?: string | null };
export type SkillCategory = { name: string; items: string[] };
export type Language = { name: string; level: string };
export type Certification = { name: string; issuer?: string | null; year?: number | null; url?: string | null };
export type Project = {
  name: string;
  description?: string | null;
  technologies: string[];
  year?: number | null;
  url?: string | null;
};
export type Volunteering = {
  role: string;
  organization: string;
  start?: string | null;
  end?: string | null;
  description?: string | null;
};
export type Publication = { title: string; publisher?: string | null; year?: number | null; url?: string | null };

/** Un profil de recherche : ses postes, ses filtres et sa façon de retenir les offres. */
export type SearchProfile = {
  id: string;
  name: string;
  roles: string[];
  technologies: string[];
  excluded_keywords: string[];
  seniority: Seniority;
  contract_types: ContractType[];
  locations: string[];
  radius_km: number;
  remote: RemotePolicy;
  salary_min?: number | null;
  max_age_days: MaxAgeDays;
  match_mode: MatchMode;
  focus_skills: string[];
  min_skills: number;
  /** Masquée de l'écran Offres, gardée au profil. */
  archived: boolean;
};

export type Profile = {
  identity: {
    full_name: string;
    headline: string;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    availability?: string | null;
    summary?: string | null;
    links: Link[];
  };
  searches: SearchProfile[];
  experiences: Experience[];
  education: Education[];
  skills: SkillCategory[];
  certifications: Certification[];
  projects: Project[];
  volunteering: Volunteering[];
  publications: Publication[];
  languages: Language[];
  soft_skills: string[];
  interests: string[];
};

export const seniorityLabels: Record<Seniority, string> = {
  graduate: "Jeune diplômé",
  mid: "Confirmé",
  senior: "Senior",
  lead: "Lead",
};

export const contractLabels: Record<ContractType, string> = {
  cdi: "CDI",
  cdd: "CDD",
  freelance: "Freelance",
  alternance: "Alternance",
  stage: "Stage",
};

export const remoteLabels: Record<RemotePolicy, string> = {
  onsite: "Sur site",
  hybrid: "Hybride",
  remote: "Télétravail",
  any: "Indifférent",
};

export const matchModeLabels: Record<MatchMode, string> = {
  domain: "Tout le métier",
  skills: "Mes compétences",
};

export const maxAgeLabels: Record<MaxAgeDays, string> = {
  1: "24 h",
  3: "3 j",
  7: "7 j",
  14: "14 j",
  30: "30 j",
};

export function emptyProfile(): Profile {
  return {
    identity: { full_name: "", headline: "", email: "", phone: "", location: "", availability: "", summary: "", links: [] },
    searches: [emptySearch("Principal")],
    experiences: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    volunteering: [],
    publications: [],
    languages: [],
    soft_skills: [],
    interests: [],
  };
}

/** Nouveau profil de recherche : l'identifiant est attribué par le serveur à partir du nom. */
export function emptySearch(name = ""): SearchProfile {
  return {
    id: "",
    name,
    roles: [],
    technologies: [],
    excluded_keywords: [],
    seniority: "mid",
    contract_types: ["cdi"],
    locations: [],
    radius_km: 30,
    remote: "any",
    salary_min: null,
    max_age_days: 7,
    match_mode: "domain",
    focus_skills: [],
    min_skills: 2,
    archived: false,
  };
}

/**
 * Ajoute une recherche : vide, ou copiée d'une recherche existante (identifiant ou position).
 * Renvoie la position de la nouvelle recherche. La copie garde tout sauf le nom et l'identifiant.
 */
export function addSearch(profile: Profile, from?: string | number): number {
  const source =
    typeof from === "number" ? profile.searches[from] : profile.searches.find((search) => from && search.id === from);
  const search = source
    ? { ...structuredClone(source), id: "", name: `${source.name} (copie)`, archived: false }
    : emptySearch(`Recherche ${profile.searches.length + 1}`);
  profile.searches.push(search);
  return profile.searches.length - 1;
}

/** Compétences proposées pour le mode « Mes compétences » : technos de la recherche et du profil. */
export function skillPool(profile: Profile, search: SearchProfile): string[] {
  const all = [...search.technologies, ...profile.skills.flatMap((category) => category.items)];
  return all.filter((item, index) => all.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index);
}

export function emptyExperience(): Experience {
  return { title: "", company: "", location: "", contract: "", start: "", end: "", context: "", groups: [{ title: "", bullets: [] }], technologies: [] };
}

const blank = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

/** Nettoie le formulaire avant envoi : chaînes vides en null, lignes vides retirées. */
export function toPayload(profile: Profile): Profile {
  const { identity } = profile;
  return {
    ...profile,
    identity: {
      ...identity,
      email: blank(identity.email),
      phone: blank(identity.phone),
      location: blank(identity.location),
      availability: blank(identity.availability),
      summary: blank(identity.summary),
      links: identity.links.filter((link) => link.label.trim() && link.url.trim()),
    },
    experiences: profile.experiences.map((experience) => ({
      ...experience,
      location: blank(experience.location),
      contract: blank(experience.contract),
      end: blank(experience.end),
      context: blank(experience.context),
      groups: experience.groups
        .map((group) => ({ title: blank(group.title), bullets: joinBullets(group.bullets) }))
        .filter((group) => group.title || group.bullets.length),
    })),
    searches: profile.searches.map((search) => ({
      ...search,
      name: search.name.trim() || "Recherche",
      min_skills: Math.max(1, Math.min(search.min_skills, 10)),
    })),
    education: profile.education
      .filter((entry) => entry.degree.trim() && entry.school.trim())
      .map((entry) => ({ ...entry, details: blank(entry.details) })),
    certifications: profile.certifications
      .filter((item) => item.name.trim())
      .map((item) => ({ ...item, issuer: blank(item.issuer), url: blank(item.url) })),
    projects: profile.projects
      .filter((item) => item.name.trim())
      .map((item) => ({ ...item, description: blank(item.description), url: blank(item.url) })),
    volunteering: profile.volunteering
      .filter((item) => item.role.trim() && item.organization.trim())
      .map((item) => ({ ...item, start: blank(item.start), end: blank(item.end), description: blank(item.description) })),
    publications: profile.publications
      .filter((item) => item.title.trim())
      .map((item) => ({ ...item, publisher: blank(item.publisher), url: blank(item.url) })),
    skills: profile.skills.filter((category) => category.name.trim() && category.items.length),
    languages: profile.languages.filter((language) => language.name.trim() && language.level.trim()),
  };
}

export type StepErrors = Record<string, string>;

const yearMonth = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validateIdentity(profile: Profile): StepErrors {
  const errors: StepErrors = {};
  if (!profile.identity.full_name.trim()) errors.full_name = "Indique ton nom.";
  if (!profile.identity.headline.trim()) errors.headline = "Indique le titre qui apparaîtra sur ton CV.";
  const email = profile.identity.email?.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Adresse e-mail invalide.";
  return errors;
}

/** Erreurs indexées par profil de recherche : « 0.roles », « 1.contract_types »... */
export function validateSearch(profile: Profile): StepErrors {
  const errors: StepErrors = {};
  profile.searches.forEach((search, index) => {
    if (!search.name.trim()) errors[`${index}.name`] = "Donne un nom à cette recherche.";
    if (!search.roles.length) errors[`${index}.roles`] = "Ajoute au moins un poste recherché.";
    if (!search.contract_types.length) errors[`${index}.contract_types`] = "Choisis au moins un type de contrat.";
    if (search.match_mode === "skills" && !search.focus_skills.length && !search.technologies.length)
      errors[`${index}.focus_skills`] = "Choisis les compétences à faire ressortir.";
  });
  if (profile.searches.every((search) => search.archived))
    errors["0.archived"] = "Garde au moins une recherche active.";
  return errors;
}

export function validateBackground(profile: Profile): StepErrors {
  const errors: StepErrors = {};
  profile.volunteering.forEach((item, index) => {
    for (const field of ["start", "end"] as const) {
      const value = item[field]?.trim();
      if (value && !yearMonth.test(value)) errors[`volunteering.${index}.${field}`] = "Format AAAA-MM.";
    }
  });
  return errors;
}

export function validateExperiences(profile: Profile): StepErrors {
  const errors: StepErrors = {};
  profile.experiences.forEach((experience, index) => {
    if (!experience.title.trim()) errors[`${index}.title`] = "Poste requis.";
    if (!experience.company.trim()) errors[`${index}.company`] = "Entreprise requise.";
    if (!yearMonth.test(experience.start)) errors[`${index}.start`] = "Format AAAA-MM.";
    const end = experience.end?.trim();
    if (end && !yearMonth.test(end)) errors[`${index}.end`] = "Format AAAA-MM.";
    else if (end && yearMonth.test(experience.start) && end < experience.start)
      errors[`${index}.end`] = "La fin précède le début.";
  });
  return errors;
}

function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + (month - 1);
}

function currentMonth(now: Date) {
  return now.getFullYear() * 12 + now.getMonth();
}

function monthsLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years > 0 && `${years} an${years > 1 ? "s" : ""}`, rest > 0 && `${rest} mois`].filter(Boolean);
  return parts.length ? parts.join(" ") : "Moins d'un mois";
}

/** Durée d'un poste, le mois de début et le mois de fin compris. */
export function experienceDuration(experience: Pick<Experience, "start" | "end">, now: Date = new Date()) {
  const end = experience.end ? monthIndex(experience.end) : currentMonth(now);
  return monthsLabel(Math.max(0, end - monthIndex(experience.start) + 1));
}

/** Expérience totale : deux postes menés en même temps ne comptent qu'une fois. */
export function totalExperience(experiences: Pick<Experience, "start" | "end">[], now: Date = new Date()) {
  const periods = experiences
    .map((item) => [monthIndex(item.start), item.end ? monthIndex(item.end) : currentMonth(now)] as const)
    .sort((a, b) => a[0] - b[0]);
  let months = 0;
  let covered = -Infinity;
  for (const [start, end] of periods) {
    const from = Math.max(start, covered + 1);
    if (end >= from) {
      months += end - from + 1;
      covered = end;
    }
  }
  return months === 0 ? null : monthsLabel(months);
}

/** Compétences à montrer : celles du profil ; à défaut, les technologies citées dans les expériences. */
export function skillGroups(profile: Pick<Profile, "skills" | "experiences">) {
  if (profile.skills.length > 0) return profile.skills;
  const items = [...new Set(profile.experiences.flatMap((experience) => experience.technologies))];
  return items.length ? [{ name: "Technologies", items }] : [];
}

/** Un lien du profil ne s'ouvre que s'il mène vers le web. */
export function isWebLink(url: string) {
  return /^https?:\/\//i.test(url);
}

/** Un texte collé d'un CV garde parfois sa puce : la liste affiche déjà la sienne. */
export function cleanBullet(text: string) {
  return text.replace(/^[\s•·▪*–—-]+/, "");
}

const BULLET_MARKER = /^\s*(?:[•·▪]\s*|[*–—-]\s+)/;

/**
 * Remet en une réalisation par élément un texte collé d'un PDF, où chaque ligne visuelle est coupée.
 * Dès qu'une puce est présente, une ligne sans puce prolonge la précédente. Sans aucune puce,
 * seule une ligne en minuscule qui suit une phrase inachevée la prolonge.
 */
export function joinBullets(lines: string[]) {
  const marked = lines.some((line) => BULLET_MARKER.test(line));
  const bullets: string[] = [];
  let open = false;
  for (const line of lines) {
    const text = line.replace(BULLET_MARKER, "").trim();
    if (!text) {
      open = false;
      continue;
    }
    const previous = bullets[bullets.length - 1] ?? "";
    const continues = open && !BULLET_MARKER.test(line) && (marked || (/^\p{Ll}/u.test(text) && !/[.!?:;]$/.test(previous)));
    if (continues) bullets[bullets.length - 1] = /\p{L}-$/u.test(previous) ? previous + text : `${previous} ${text}`;
    else bullets.push(text);
    open = true;
  }
  return bullets;
}

/** Le début des réalisations d'un poste : les groupes tronqués, et le nombre de puces restantes. */
export function previewGroups(groups: ExperienceGroup[], limit = 3) {
  let left = limit;
  const shown: ExperienceGroup[] = [];
  for (const group of groups) {
    if (left <= 0) break;
    shown.push({ ...group, bullets: group.bullets.slice(0, left) });
    left -= group.bullets.length;
  }
  const total = groups.reduce((count, group) => count + group.bullets.length, 0);
  return { groups: shown, hidden: Math.max(0, total - limit) };
}
