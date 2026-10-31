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
  };
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
        .map((group) => ({ title: blank(group.title), bullets: group.bullets.map((b) => b.trim()).filter(Boolean) }))
        .filter((group) => group.title || group.bullets.length),
    })),
    searches: profile.searches.map((search) => ({
      ...search,
      name: search.name.trim() || "Recherche",
      min_skills: Math.max(1, Math.min(search.min_skills, 10)),
    })),
    education: profile.education.filter((entry) => entry.degree.trim() && entry.school.trim()),
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
