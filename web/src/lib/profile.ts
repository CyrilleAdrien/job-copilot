/** Types du profil, alignés sur le schéma Pydantic du service profile. */

export type Seniority = "graduate" | "mid" | "senior" | "lead";
export type ContractType = "cdi" | "cdd" | "freelance" | "alternance" | "stage";
export type RemotePolicy = "onsite" | "hybrid" | "remote" | "any";
export type MaxAgeDays = 1 | 3 | 7 | 14 | 30;

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
  search: {
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
  };
  experiences: Experience[];
  education: Education[];
  skills: SkillCategory[];
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
    search: {
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
    },
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    soft_skills: [],
    interests: [],
  };
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
    education: profile.education.filter((entry) => entry.degree.trim() && entry.school.trim()),
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

export function validateSearch(profile: Profile): StepErrors {
  const errors: StepErrors = {};
  if (!profile.search.roles.length) errors.roles = "Ajoute au moins un poste recherché.";
  if (!profile.search.contract_types.length) errors.contract_types = "Choisis au moins un type de contrat.";
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
