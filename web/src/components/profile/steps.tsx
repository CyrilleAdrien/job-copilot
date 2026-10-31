"use client";

import { Archive, ArchiveRestore, Copy, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { spring } from "@/lib/motion";
import {
  contractLabels,
  addSearch,
  emptyExperience,
  matchModeLabels,
  maxAgeLabels,
  remoteLabels,
  seniorityLabels,
  skillPool,
  type ContractType,
  type MatchMode,
  type MaxAgeDays,
  type Profile,
  type RemotePolicy,
  type SearchProfile,
  type Seniority,
  type StepErrors,
} from "@/lib/profile";
import * as suggestions from "@/lib/suggestions";
import { cn } from "@/lib/utils";

export type StepProps = {
  profile: Profile;
  update: (recipe: (draft: Profile) => void) => void;
  errors: StepErrors;
  /** Recherche à ouvrir d'emblée (étape Recherches). */
  focus?: number;
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
      <Combobox
        label="Ville"
        value={identity.location ?? ""}
        onChange={(location) => update((draft) => void (draft.identity.location = location))}
        suggestions={suggestions.cities}
        placeholder="Paris / Île-de-France"
      />
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
              className="grid grid-cols-[1fr_auto] items-start gap-2 md:grid-cols-[160px_1fr_auto]"
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

export function SearchStep({ profile, update, errors, focus }: StepProps) {
  const [selected, setSelected] = useState(focus ?? 0);
  const firstError = Object.keys(errors)[0];

  useEffect(() => {
    if (firstError) setSelected(Number(firstError.split(".")[0]) || 0);
  }, [firstError]);

  const index = Math.min(selected, profile.searches.length - 1);
  const search = profile.searches[index];
  const pool = skillPool(profile, search);
  const set = (recipe: (draft: SearchProfile) => void) => update((draft) => recipe(draft.searches[index]));
  const error = (field: string) => errors[`${index}.${field}`];

  const add = (from?: number) => {
    update((draft) => void addSearch(draft, from));
    setSelected(profile.searches.length);
  };
  const remove = () => {
    update((draft) => void draft.searches.splice(index, 1));
    setSelected(Math.max(0, index - 1));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium">Tes recherches</span>
        <div role="tablist" aria-label="Profils de recherche" className="flex flex-wrap items-center gap-2">
          {profile.searches.map((item, position) => (
            <button
              key={position}
              type="button"
              role="tab"
              aria-selected={position === index}
              onClick={() => setSelected(position)}
              className={cn(
                "relative inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors",
                position === index ? "text-accent-strong" : "text-text-secondary hover:text-text",
                Object.keys(errors).some((key) => key.startsWith(`${position}.`)) && "text-danger",
              )}
            >
              {position === index && (
                <motion.span
                  layoutId="search-tab"
                  transition={spring.snappy}
                  className="absolute inset-0 rounded-full border border-accent-strong/40 bg-accent-soft"
                />
              )}
              <span className={cn("relative", item.archived && "opacity-60")}>{item.name.trim() || "Sans nom"}</span>
              {item.archived && <Archive className="relative ml-1.5 size-3.5 text-text-tertiary" aria-label="archivée" />}
            </button>
          ))}
          {profile.searches.length < 10 && (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => add()}>
                <Plus aria-hidden />
                Nouvelle recherche
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => add(index)}>
                <Copy aria-hidden />
                Dupliquer « {search.name.trim() || "Sans nom"} »
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-text-tertiary">
          Une recherche par métier visé, par exemple DevOps et Data Engineer. Chacune a sa propre liste d&apos;offres.
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={spring.smooth}
          className="flex flex-col gap-6 rounded-card border border-border bg-background-subtle p-5"
        >
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Nom de la recherche"
                value={search.name}
                error={error("name")}
                placeholder="DevOps, Data Engineer..."
                onChange={(event) => set((draft) => void (draft.name = event.target.value))}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-0.5"
              disabled={!search.archived && profile.searches.filter((item) => !item.archived).length < 2}
              title={search.archived ? undefined : "Masque cette recherche de l'écran Offres, sans la perdre"}
              onClick={() => set((draft) => void (draft.archived = !draft.archived))}
            >
              {search.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {search.archived ? "Restaurer" : "Archiver"}
            </Button>
            {profile.searches.length > 1 && (
              <RemoveButton label="Supprimer cette recherche" onClick={remove} />
            )}
          </div>
          {search.archived && (
            <p className="-mt-3 text-xs text-text-tertiary">
              Archivée : elle n&apos;apparaît plus sur l&apos;écran Offres, mais ses réglages et ses favoris sont gardés.
            </p>
          )}
          {error("archived") && <p className="-mt-3 text-xs text-danger">{error("archived")}</p>}
          <TagInput
            label="Postes recherchés"
            value={search.roles}
            onChange={(roles) => set((draft) => void (draft.roles = roles))}
            placeholder="Ingénieur SRE, DevOps..."
            hint="Entrée pour valider chaque intitulé."
            error={error("roles")}
            suggestions={suggestions.roles}
          />
          <TagInput
            label="Technologies"
            value={search.technologies}
            onChange={(technologies) => set((draft) => void (draft.technologies = technologies))}
            placeholder="Kubernetes, Python, Terraform..."
            hint="Elles pèsent dans le score de pertinence des offres."
            suggestions={suggestions.technologies}
          />

          <MatchSettings search={search} pool={pool} set={set} error={error("focus_skills")} />

          <Labeled label="Niveau">
            <SegmentedControl<Seniority>
              label="Niveau"
              value={search.seniority}
              onChange={(seniority) => set((draft) => void (draft.seniority = seniority))}
              segments={options(seniorityLabels)}
            />
          </Labeled>
          <ChoiceChips<ContractType>
            label="Types de contrat"
            options={options(contractLabels)}
            value={search.contract_types}
            onChange={(types) => set((draft) => void (draft.contract_types = types))}
            error={error("contract_types")}
          />
          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <TagInput
              label="Localisations"
              value={search.locations}
              onChange={(locations) => set((draft) => void (draft.locations = locations))}
              placeholder="Paris, Lyon..."
              suggestions={suggestions.cities}
            />
            <Input
              label="Rayon (km)"
              type="number"
              min={0}
              max={500}
              value={search.radius_km}
              onChange={(event) => set((draft) => void (draft.radius_km = Number(event.target.value) || 0))}
            />
          </div>
          <Labeled label="Télétravail">
            <SegmentedControl<RemotePolicy>
              label="Télétravail"
              value={search.remote}
              onChange={(remote) => set((draft) => void (draft.remote = remote))}
              segments={options(remoteLabels)}
            />
          </Labeled>
          <Labeled label="Date de publication" hint="Les offres les plus récentes passent en premier.">
            <SegmentedControl<`${MaxAgeDays}`>
              label="Date de publication"
              value={`${search.max_age_days}`}
              onChange={(days) => set((draft) => void (draft.max_age_days = Number(days) as MaxAgeDays))}
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
                set((draft) => void (draft.salary_min = event.target.value ? Number(event.target.value) : null))
              }
            />
            <TagInput
              label="Mots à exclure"
              value={search.excluded_keywords}
              onChange={(words) => set((draft) => void (draft.excluded_keywords = words))}
              placeholder="Stage, Junior..."
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Mode de sélection des offres : tout le métier, ou seulement celles qui citent mes compétences. */
function MatchSettings({
  search,
  pool,
  set,
  error,
}: {
  search: SearchProfile;
  pool: string[];
  set: (recipe: (draft: SearchProfile) => void) => void;
  error?: string;
}) {
  const skills = search.focus_skills.length ? search.focus_skills : search.technologies;
  const max = Math.max(1, Math.min(skills.length, 10));
  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-border bg-surface p-4">
      <Labeled
        label="Offres à afficher"
        hint={
          search.match_mode === "domain"
            ? "Toutes les offres du métier, classées par pertinence avec tes technologies."
            : "Seulement les offres qui citent assez de compétences parmi celles que tu choisis."
        }
      >
        <SegmentedControl<MatchMode>
          label="Offres à afficher"
          value={search.match_mode}
          onChange={(mode) => set((draft) => void (draft.match_mode = mode))}
          segments={options(matchModeLabels)}
        />
      </Labeled>
      <AnimatePresence initial={false}>
        {search.match_mode === "skills" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.smooth}
            className="flex flex-col gap-4 overflow-hidden"
          >
            <TagInput
              label="Compétences à faire ressortir"
              value={search.focus_skills}
              onChange={(focus) =>
                set((draft) => {
                  draft.focus_skills = focus;
                  draft.min_skills = Math.min(draft.min_skills, Math.max(1, focus.length));
                })
              }
              placeholder={search.technologies.length ? "Vide : les technologies ci-dessus" : "Python, Airflow, dbt..."}
              suggestions={[...pool, ...suggestions.technologies]}
              error={error}
            />
            {pool.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Compétences de ton profil">
                {pool
                  .filter((item) => !search.focus_skills.includes(item))
                  .slice(0, 8)
                  .map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => set((draft) => void draft.focus_skills.push(item))}
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 text-[12px] text-text-secondary transition-colors hover:border-accent hover:text-accent-strong"
                    >
                      <Plus className="size-3" aria-hidden />
                      {item}
                    </button>
                  ))}
              </div>
            )}
            <Slider
              label="Compétences citées au minimum"
              value={Math.min(search.min_skills, max)}
              min={1}
              max={max}
              onChange={(value) => set((draft) => void (draft.min_skills = value))}
              format={(value) => `${value} sur ${skills.length || 1}`}
              hint="Plus le seuil est haut, plus les offres sont proches de ton profil, et moins il y en a."
            />
          </motion.div>
        )}
      </AnimatePresence>
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
              <Combobox
                label="Contrat"
                placeholder="CDI, Alternance..."
                value={experience.contract ?? ""}
                suggestions={suggestions.contractNames}
                onChange={(contract) => update((draft) => void (draft.experiences[index].contract = contract))}
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
              suggestions={suggestions.technologies}
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
          <Row key={index} columns="md:grid-cols-[220px_1fr_auto]">
            <Combobox
              ariaLabel="Catégorie"
              placeholder="Conteneurs et cloud"
              value={category.name}
              suggestions={suggestions.skillCategories}
              onChange={(name) => update((draft) => void (draft.skills[index].name = name))}
            />
            <TagInput
              label=""
              ariaLabel="Compétences de la catégorie"
              value={category.items}
              onChange={(items) => update((draft) => void (draft.skills[index].items = items))}
              placeholder="Docker, Kubernetes..."
              suggestions={suggestions.technologies}
            />
            <RemoveButton label="Retirer la catégorie" onClick={() => update((draft) => void draft.skills.splice(index, 1))} />
          </Row>
        ))}
        <AddButton onClick={() => update((draft) => void draft.skills.push({ name: "", items: [] }))}>Ajouter une catégorie</AddButton>
      </Group>

      <Group title="Langues" hint="Choisis dans la liste ou écris librement, par exemple « B2 (TOEIC 830) ».">
        {profile.languages.map((language, index) => (
          <Row key={index} columns="md:grid-cols-[1fr_1fr_auto]">
            <Combobox
              ariaLabel="Langue"
              placeholder="Anglais"
              value={language.name}
              suggestions={suggestions.languageNames.filter(
                (name) => name === language.name || !profile.languages.some((other) => other.name === name),
              )}
              onChange={(name) => update((draft) => void (draft.languages[index].name = name))}
            />
            <Combobox
              ariaLabel="Niveau"
              placeholder="Niveau"
              value={language.level}
              suggestions={suggestions.languageLevels}
              onChange={(level) => update((draft) => void (draft.languages[index].level = level))}
            />
            <RemoveButton label="Retirer la langue" onClick={() => update((draft) => void draft.languages.splice(index, 1))} />
          </Row>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          {["Français", "Anglais"]
            .filter((name) => !profile.languages.some((language) => language.name === name))
            .map((name) => (
              <QuickAdd key={name} onClick={() => update((draft) => void draft.languages.push({ name, level: "" }))}>
                {name}
              </QuickAdd>
            ))}
          <AddButton onClick={() => update((draft) => void draft.languages.push({ name: "", level: "" }))}>Autre langue</AddButton>
        </div>
      </Group>

      <div className="grid gap-4 md:grid-cols-2">
        <TagInput
          label="Savoir-être"
          value={profile.soft_skills}
          onChange={(items) => update((draft) => void (draft.soft_skills = items))}
          placeholder="Rigueur, travail en équipe..."
          suggestions={suggestions.softSkills}
        />
        <TagInput label="Centres d'intérêt" value={profile.interests} onChange={(items) => update((draft) => void (draft.interests = items))} />
      </div>
    </div>
  );
}

const yearValue = (value: string) => (value ? Number(value.replace(/\D/g, "").slice(0, 4)) || null : null);

export function BackgroundStep({ profile, update, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-8">
      <Group title="Formation">
        {profile.education.map((entry, index) => (
          <Row key={index} columns="md:grid-cols-[1fr_1fr_96px_auto]">
            <Input aria-label="Diplôme" placeholder="Diplôme" value={entry.degree} onChange={(event) => update((draft) => void (draft.education[index].degree = event.target.value))} />
            <Input aria-label="École" placeholder="École" value={entry.school} onChange={(event) => update((draft) => void (draft.education[index].school = event.target.value))} />
            <Input
              aria-label="Année"
              placeholder="Année"
              inputMode="numeric"
              value={entry.year ?? ""}
              onChange={(event) => update((draft) => void (draft.education[index].year = yearValue(event.target.value)))}
            />
            <RemoveButton label="Retirer la formation" onClick={() => update((draft) => void draft.education.splice(index, 1))} />
          </Row>
        ))}
        <AddButton onClick={() => update((draft) => void draft.education.push({ degree: "", school: "", year: null }))}>Ajouter une formation</AddButton>
      </Group>

      <Group title="Certifications">
        {profile.certifications.map((entry, index) => (
          <Row key={index} columns="md:grid-cols-[1.4fr_1fr_96px_auto]">
            <Input aria-label="Certification" placeholder="Certified Kubernetes Administrator" value={entry.name} onChange={(event) => update((draft) => void (draft.certifications[index].name = event.target.value))} />
            <Input aria-label="Organisme" placeholder="Organisme" value={entry.issuer ?? ""} onChange={(event) => update((draft) => void (draft.certifications[index].issuer = event.target.value))} />
            <Input
              aria-label="Année"
              placeholder="Année"
              inputMode="numeric"
              value={entry.year ?? ""}
              onChange={(event) => update((draft) => void (draft.certifications[index].year = yearValue(event.target.value)))}
            />
            <RemoveButton label="Retirer la certification" onClick={() => update((draft) => void draft.certifications.splice(index, 1))} />
          </Row>
        ))}
        <AddButton onClick={() => update((draft) => void draft.certifications.push({ name: "", issuer: "", year: null }))}>Ajouter une certification</AddButton>
      </Group>

      <Group title="Projets" hint="Projets personnels, open source ou académiques qui montrent ce que tu sais faire.">
        {profile.projects.map((entry, index) => (
          <Card key={index} onRemove={() => update((draft) => void draft.projects.splice(index, 1))} label="Retirer le projet">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_96px]">
              <Input aria-label="Nom du projet" placeholder="Nom du projet" value={entry.name} onChange={(event) => update((draft) => void (draft.projects[index].name = event.target.value))} />
              <Input aria-label="Lien" placeholder="https://github.com/..." value={entry.url ?? ""} onChange={(event) => update((draft) => void (draft.projects[index].url = event.target.value))} />
              <Input
                aria-label="Année"
                placeholder="Année"
                inputMode="numeric"
                value={entry.year ?? ""}
                onChange={(event) => update((draft) => void (draft.projects[index].year = yearValue(event.target.value)))}
              />
            </div>
            <Textarea
              aria-label="Description"
              className="min-h-16"
              placeholder="Ce que fait le projet, en une ou deux phrases."
              value={entry.description ?? ""}
              onChange={(event) => update((draft) => void (draft.projects[index].description = event.target.value))}
            />
            <TagInput
              label=""
              ariaLabel="Technologies du projet"
              placeholder="Technologies"
              value={entry.technologies}
              onChange={(items) => update((draft) => void (draft.projects[index].technologies = items))}
              suggestions={suggestions.technologies}
            />
          </Card>
        ))}
        <AddButton onClick={() => update((draft) => void draft.projects.push({ name: "", description: "", technologies: [], url: "", year: null }))}>
          Ajouter un projet
        </AddButton>
      </Group>

      <Group title="Bénévolat et engagements">
        {profile.volunteering.map((entry, index) => (
          <Card key={index} onRemove={() => update((draft) => void draft.volunteering.splice(index, 1))} label="Retirer l'engagement">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_110px_110px]">
              <Input aria-label="Rôle" placeholder="Rôle" value={entry.role} onChange={(event) => update((draft) => void (draft.volunteering[index].role = event.target.value))} />
              <Input aria-label="Organisation" placeholder="Organisation" value={entry.organization} onChange={(event) => update((draft) => void (draft.volunteering[index].organization = event.target.value))} />
              <Input
                aria-label="Début"
                placeholder="2023-01"
                value={entry.start ?? ""}
                error={errors[`volunteering.${index}.start`]}
                onChange={(event) => update((draft) => void (draft.volunteering[index].start = event.target.value))}
              />
              <Input
                aria-label="Fin"
                placeholder="En cours"
                value={entry.end ?? ""}
                error={errors[`volunteering.${index}.end`]}
                onChange={(event) => update((draft) => void (draft.volunteering[index].end = event.target.value))}
              />
            </div>
            <Textarea
              aria-label="Description"
              className="min-h-16"
              placeholder="Ce que tu y fais."
              value={entry.description ?? ""}
              onChange={(event) => update((draft) => void (draft.volunteering[index].description = event.target.value))}
            />
          </Card>
        ))}
        <AddButton onClick={() => update((draft) => void draft.volunteering.push({ role: "", organization: "", start: "", end: "", description: "" }))}>
          Ajouter un engagement
        </AddButton>
      </Group>

      <Group title="Publications">
        {profile.publications.map((entry, index) => (
          <Row key={index} columns="md:grid-cols-[1.4fr_1fr_96px_auto]">
            <Input aria-label="Titre" placeholder="Titre" value={entry.title} onChange={(event) => update((draft) => void (draft.publications[index].title = event.target.value))} />
            <Input aria-label="Éditeur ou site" placeholder="Éditeur, revue, blog" value={entry.publisher ?? ""} onChange={(event) => update((draft) => void (draft.publications[index].publisher = event.target.value))} />
            <Input
              aria-label="Année"
              placeholder="Année"
              inputMode="numeric"
              value={entry.year ?? ""}
              onChange={(event) => update((draft) => void (draft.publications[index].year = yearValue(event.target.value)))}
            />
            <RemoveButton label="Retirer la publication" onClick={() => update((draft) => void draft.publications.splice(index, 1))} />
          </Row>
        ))}
        <AddButton onClick={() => update((draft) => void draft.publications.push({ title: "", publisher: "", year: null }))}>Ajouter une publication</AddButton>
      </Group>
    </div>
  );
}

/** Ligne de champs : empilés sur mobile, en colonnes à partir de md. */
function Row({ columns, children }: { columns: string; children: ReactNode }) {
  return <div className={cn("grid items-start gap-2", columns)}>{children}</div>;
}

function Card({ onRemove, label, children }: { onRemove: () => void; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-[12px] border border-border bg-background-subtle p-3">
      <div className="flex flex-1 flex-col gap-3">{children}</div>
      <RemoveButton label={label} onClick={onRemove} />
    </div>
  );
}

function QuickAdd({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border-strong px-3 text-[13px] text-text-secondary transition-colors hover:border-accent hover:text-accent-strong"
    >
      <Plus className="size-3.5" aria-hidden />
      {children}
    </button>
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
