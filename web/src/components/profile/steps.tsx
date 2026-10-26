"use client";

import { Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { spring } from "@/lib/motion";
import {
  contractLabels,
  emptyExperience,
  maxAgeLabels,
  remoteLabels,
  seniorityLabels,
  type ContractType,
  type MaxAgeDays,
  type Profile,
  type RemotePolicy,
  type Seniority,
  type StepErrors,
} from "@/lib/profile";

export type StepProps = {
  profile: Profile;
  update: (recipe: (draft: Profile) => void) => void;
  errors: StepErrors;
};

const options = <T extends string | number>(labels: Record<T, string>) =>
  (Object.entries(labels) as [string, string][]).map(([value, label]) => ({ value: value as `${T}`, label }));

export function IdentityStep({ profile, update, errors }: StepProps) {
  const { identity } = profile;
  const set = (field: keyof Profile["identity"]) => (event: { target: { value: string } }) =>
    update((draft) => {
      (draft.identity as Record<string, unknown>)[field] = event.target.value;
    });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Input label="Nom complet" value={identity.full_name} onChange={set("full_name")} error={errors.full_name} autoComplete="name" />
      <Input
        label="Titre du CV"
        value={identity.headline}
        onChange={set("headline")}
        error={errors.headline}
        placeholder="Ingénieur DevOps / SRE"
      />
      <Input label="E-mail" type="email" value={identity.email ?? ""} onChange={set("email")} error={errors.email} autoComplete="email" />
      <Input label="Téléphone" value={identity.phone ?? ""} onChange={set("phone")} autoComplete="tel" />
      <Input label="Ville" value={identity.location ?? ""} onChange={set("location")} placeholder="Paris / Île-de-France" />
      <Input label="Disponibilité" value={identity.availability ?? ""} onChange={set("availability")} placeholder="Disponible immédiatement" />
      <div className="md:col-span-2">
        <Textarea
          label="Résumé du profil"
          value={identity.summary ?? ""}
          onChange={set("summary")}
          hint="Trois à cinq phrases. Il sert de base au paragraphe « Profil » du CV."
        />
      </div>
      <div className="flex flex-col gap-3 md:col-span-2">
        <span className="text-[13px] font-medium">Liens</span>
        <AnimatePresence initial={false}>
          {identity.links.map((link, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.smooth}
              className="grid grid-cols-[160px_1fr_auto] items-start gap-2"
            >
              <Input
                aria-label="Libellé"
                placeholder="GitHub"
                value={link.label}
                onChange={(event) => update((draft) => void (draft.identity.links[index].label = event.target.value))}
              />
              <Input
                aria-label="Adresse"
                placeholder="https://github.com/..."
                value={link.url}
                onChange={(event) => update((draft) => void (draft.identity.links[index].url = event.target.value))}
              />
              <RemoveButton label="Retirer le lien" onClick={() => update((draft) => void draft.identity.links.splice(index, 1))} />
            </motion.div>
          ))}
        </AnimatePresence>
        <AddButton onClick={() => update((draft) => void draft.identity.links.push({ label: "", url: "" }))}>Ajouter un lien</AddButton>
      </div>
    </div>
  );
}

export function SearchStep({ profile, update, errors }: StepProps) {
  const { search } = profile;
  return (
    <div className="flex flex-col gap-6">
      <TagInput
        label="Postes recherchés"
        value={search.roles}
        onChange={(roles) => update((draft) => void (draft.search.roles = roles))}
        placeholder="Ingénieur SRE, DevOps..."
        hint="Entrée pour valider chaque intitulé."
        error={errors.roles}
      />
      <TagInput
        label="Technologies"
        value={search.technologies}
        onChange={(technologies) => update((draft) => void (draft.search.technologies = technologies))}
        placeholder="Kubernetes, Python, Terraform..."
        hint="Elles pèsent dans le score de pertinence des offres."
      />
      <Labeled label="Niveau">
        <SegmentedControl<Seniority>
          label="Niveau"
          value={search.seniority}
          onChange={(seniority) => update((draft) => void (draft.search.seniority = seniority))}
          segments={options(seniorityLabels)}
        />
      </Labeled>
      <ChoiceChips<ContractType>
        label="Types de contrat"
        options={options(contractLabels)}
        value={search.contract_types}
        onChange={(types) => update((draft) => void (draft.search.contract_types = types))}
        error={errors.contract_types}
      />
      <div className="grid gap-4 md:grid-cols-[1fr_140px]">
        <TagInput
          label="Localisations"
          value={search.locations}
          onChange={(locations) => update((draft) => void (draft.search.locations = locations))}
          placeholder="Paris, Lyon..."
        />
        <Input
          label="Rayon (km)"
          type="number"
          min={0}
          max={500}
          value={search.radius_km}
          onChange={(event) => update((draft) => void (draft.search.radius_km = Number(event.target.value) || 0))}
        />
      </div>
      <Labeled label="Télétravail">
        <SegmentedControl<RemotePolicy>
          label="Télétravail"
          value={search.remote}
          onChange={(remote) => update((draft) => void (draft.search.remote = remote))}
          segments={options(remoteLabels)}
        />
      </Labeled>
      <Labeled label="Date de publication" hint="Les offres les plus récentes passent en premier.">
        <SegmentedControl<`${MaxAgeDays}`>
          label="Date de publication"
          value={`${search.max_age_days}`}
          onChange={(days) => update((draft) => void (draft.search.max_age_days = Number(days) as MaxAgeDays))}
          segments={options(maxAgeLabels)}
        />
      </Labeled>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Salaire minimum (€ brut annuel)"
          type="number"
          min={0}
          step={1000}
          value={search.salary_min ?? ""}
          onChange={(event) =>
            update((draft) => void (draft.search.salary_min = event.target.value ? Number(event.target.value) : null))
          }
        />
        <TagInput
          label="Mots à exclure"
          value={search.excluded_keywords}
          onChange={(words) => update((draft) => void (draft.search.excluded_keywords = words))}
          placeholder="Stage, Junior..."
        />
      </div>
    </div>
  );
}

export function ExperiencesStep({ profile, update, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {profile.experiences.map((experience, index) => (
          <motion.div
            key={index}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring.smooth}
            className="flex flex-col gap-4 rounded-card border border-border bg-background-subtle p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-text-secondary">Expérience {index + 1}</span>
              <RemoveButton label="Retirer l'expérience" onClick={() => update((draft) => void draft.experiences.splice(index, 1))} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Poste"
                value={experience.title}
                error={errors[`${index}.title`]}
                onChange={(event) => update((draft) => void (draft.experiences[index].title = event.target.value))}
              />
              <Input
                label="Entreprise"
                value={experience.company}
                error={errors[`${index}.company`]}
                onChange={(event) => update((draft) => void (draft.experiences[index].company = event.target.value))}
              />
              <Input
                label="Début"
                placeholder="2024-09"
                value={experience.start}
                error={errors[`${index}.start`]}
                onChange={(event) => update((draft) => void (draft.experiences[index].start = event.target.value))}
              />
              <Input
                label="Fin"
                placeholder="Vide si en cours"
                value={experience.end ?? ""}
                error={errors[`${index}.end`]}
                onChange={(event) => update((draft) => void (draft.experiences[index].end = event.target.value))}
              />
              <Input
                label="Lieu"
                value={experience.location ?? ""}
                onChange={(event) => update((draft) => void (draft.experiences[index].location = event.target.value))}
              />
              <Input
                label="Contrat"
                placeholder="CDI, Alternance..."
                value={experience.contract ?? ""}
                onChange={(event) => update((draft) => void (draft.experiences[index].contract = event.target.value))}
              />
            </div>
            <Textarea
              label="Contexte"
              className="min-h-16"
              value={experience.context ?? ""}
              onChange={(event) => update((draft) => void (draft.experiences[index].context = event.target.value))}
            />
            <div className="flex flex-col gap-3">
              <span className="text-[13px] font-medium">Réalisations, regroupées par thème</span>
              {experience.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Input
                        aria-label="Thème"
                        placeholder="Thème (facultatif), ex. Automatisation et CI/CD"
                        value={group.title ?? ""}
                        onChange={(event) =>
                          update((draft) => void (draft.experiences[index].groups[groupIndex].title = event.target.value))
                        }
                      />
                    </div>
                    <RemoveButton
                      label="Retirer le thème"
                      onClick={() => update((draft) => void draft.experiences[index].groups.splice(groupIndex, 1))}
                    />
                  </div>
                  <Textarea
                    aria-label="Réalisations"
                    placeholder="Une réalisation par ligne, idéalement chiffrée."
                    value={group.bullets.join("\n")}
                    onChange={(event) =>
                      update(
                        (draft) => void (draft.experiences[index].groups[groupIndex].bullets = event.target.value.split("\n")),
                      )
                    }
                  />
                </div>
              ))}
              <AddButton onClick={() => update((draft) => void draft.experiences[index].groups.push({ title: "", bullets: [] }))}>
                Ajouter un thème
              </AddButton>
            </div>
            <TagInput
              label="Technologies utilisées"
              value={experience.technologies}
              onChange={(technologies) => update((draft) => void (draft.experiences[index].technologies = technologies))}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      <AddButton onClick={() => update((draft) => void draft.experiences.push(emptyExperience()))}>Ajouter une expérience</AddButton>
    </div>
  );
}

export function SkillsStep({ profile, update }: StepProps) {
  return (
    <div className="flex flex-col gap-8">
      <Group title="Compétences par catégorie" hint="Les catégories deviennent les lignes de la section Compétences du CV.">
        {profile.skills.map((category, index) => (
          <div key={index} className="grid grid-cols-[200px_1fr_auto] items-start gap-2">
            <Input
              aria-label="Catégorie"
              placeholder="Conteneurs et cloud"
              value={category.name}
              onChange={(event) => update((draft) => void (draft.skills[index].name = event.target.value))}
            />
            <TagInput
              label=""
              ariaLabel="Compétences de la catégorie"
              value={category.items}
              onChange={(items) => update((draft) => void (draft.skills[index].items = items))}
              placeholder="Docker, Kubernetes..."
            />
            <RemoveButton label="Retirer la catégorie" onClick={() => update((draft) => void draft.skills.splice(index, 1))} />
          </div>
        ))}
        <AddButton onClick={() => update((draft) => void draft.skills.push({ name: "", items: [] }))}>Ajouter une catégorie</AddButton>
      </Group>

      <Group title="Formation">
        {profile.education.map((entry, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_96px_auto] items-start gap-2">
            <Input aria-label="Diplôme" placeholder="Diplôme" value={entry.degree} onChange={(event) => update((draft) => void (draft.education[index].degree = event.target.value))} />
            <Input aria-label="École" placeholder="École" value={entry.school} onChange={(event) => update((draft) => void (draft.education[index].school = event.target.value))} />
            <Input
              aria-label="Année"
              placeholder="Année"
              inputMode="numeric"
              value={entry.year ?? ""}
              onChange={(event) => update((draft) => void (draft.education[index].year = event.target.value ? Number(event.target.value) : null))}
            />
            <RemoveButton label="Retirer la formation" onClick={() => update((draft) => void draft.education.splice(index, 1))} />
          </div>
        ))}
        <AddButton onClick={() => update((draft) => void draft.education.push({ degree: "", school: "", year: null }))}>Ajouter une formation</AddButton>
      </Group>

      <Group title="Langues">
        {profile.languages.map((language, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
            <Input aria-label="Langue" placeholder="Anglais" value={language.name} onChange={(event) => update((draft) => void (draft.languages[index].name = event.target.value))} />
            <Input aria-label="Niveau" placeholder="B2 (TOEIC 830)" value={language.level} onChange={(event) => update((draft) => void (draft.languages[index].level = event.target.value))} />
            <RemoveButton label="Retirer la langue" onClick={() => update((draft) => void draft.languages.splice(index, 1))} />
          </div>
        ))}
        <AddButton onClick={() => update((draft) => void draft.languages.push({ name: "", level: "" }))}>Ajouter une langue</AddButton>
      </Group>

      <div className="grid gap-4 md:grid-cols-2">
        <TagInput label="Savoir-être" value={profile.soft_skills} onChange={(items) => update((draft) => void (draft.soft_skills = items))} placeholder="Rigueur, travail en équipe..." />
        <TagInput label="Centres d'intérêt" value={profile.interests} onChange={(items) => update((draft) => void (draft.interests = items))} />
      </div>
    </div>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-tertiary">{hint}</span>}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {hint && <p className="text-xs text-text-tertiary">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onClick}>
      <Plus aria-hidden />
      {children}
    </Button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick} className="text-text-tertiary hover:text-danger">
      <Trash2 aria-hidden />
    </Button>
  );
}
