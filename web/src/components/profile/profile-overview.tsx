"use client";

import { Award, BookOpen, Briefcase, ChevronDown, FolderGit2, GraduationCap, HandHeart, Heart, Languages, Sparkles, Target, Wrench } from "lucide-react";
import { useState } from "react";

import { Entries, formatMonth, Section } from "@/components/profile/profile-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { paragraphs, cleanBullet, contractLabels, experienceDuration, previewGroups, remoteLabels, seniorityLabels, skillGroups, totalExperience, type Experience, type Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

const Chip = ({ children }: { children: string }) => (
  <span className="inline-flex h-7 items-center rounded-lg border border-border bg-surface px-2.5 text-[13px] text-text-secondary transition-colors duration-150 hover:border-accent hover:bg-accent/15 hover:text-text">{children}</span>
);

function Figure({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-transparent bg-accent text-[#1f1f1f] hover:border-transparent" : "bg-background-subtle"}>
      <CardContent className="flex flex-col gap-1">
        <span className={cn("text-[13px]", !highlight && "text-text-secondary")}>{label}</span>
        <span className="text-2xl font-normal tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

const SIDE_CARD = "bg-background-subtle";

/** Le contexte et le début des réalisations d'un poste ; le reste s'ouvre à la demande. */
function JobDetails({ experience }: { experience: Experience }) {
  const [open, setOpen] = useState(false);
  const { groups: preview, hidden } = previewGroups(experience.groups);
  const groups = open ? experience.groups : preview;

  return (
    <>
      {experience.context && <p className={cn("text-sm leading-relaxed text-text-secondary", !open && "line-clamp-2")}>{paragraphs(experience.context).join(" ")}</p>}
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-1 pt-1.5">
          {group.title && (
            <h5 className="flex items-center gap-2 text-[13px] font-medium">
              <span aria-hidden className="h-3.5 w-1 rounded-full bg-accent" />
              {group.title}
            </h5>
          )}
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed text-text-secondary marker:text-accent">
            {group.bullets.map((bullet, bulletIndex) => (
              <li key={bulletIndex}>{cleanBullet(bullet)}</li>
            ))}
          </ul>
        </div>
      ))}
      {(hidden > 0 || (experience.context?.length ?? 0) > 160) && (
        <Button variant="ghost" size="sm" className="-ml-3 self-start" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Voir moins" : hidden > 0 ? `Voir plus (${hidden})` : "Voir plus"}
          <ChevronDown className={cn("transition-transform duration-150", open && "rotate-180")} aria-hidden />
        </Button>
      )}
    </>
  );
}

/** L'essentiel du profil, en un coup d'œil. Le CV complet reste dans son onglet. */
export function ProfileOverview({ profile, now }: { profile: Profile; now?: Date }) {
  const active = profile.searches.filter((search) => !search.archived);
  const skills = skillGroups(profile);
  const skillCount = new Set(skills.flatMap((group) => group.items)).size;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure highlight label="Expérience" value={totalExperience(profile.experiences, now) ?? "À renseigner"} />
        <Figure label="Compétences" value={skillCount} />
        <Figure label="Recherches actives" value={active.length} />
        <Figure label="Langues" value={profile.languages.length} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {profile.experiences.length > 0 && (
            <Section icon={Briefcase} title="Parcours">
              <ol className="flex flex-col">
                {profile.experiences.map((experience, index) => (
                  <li key={`${experience.company}-${experience.start}`} className="group relative flex gap-4 pb-5 last:pb-0">
                    {index < profile.experiences.length - 1 && <span aria-hidden className="absolute bottom-0 left-[5px] top-4 w-px bg-border" />}
                    <span aria-hidden className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 transition-transform duration-150 group-hover:scale-125", experience.end ? "border-accent bg-surface" : "border-accent bg-accent")} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <h4 className="text-sm font-medium">
                          {experience.title} <span className="font-light text-text-secondary">· {experience.company}</span>
                        </h4>
                        <span className="text-xs tabular-nums text-text-tertiary">
                          {formatMonth(experience.start)} – {formatMonth(experience.end)} · {experienceDuration(experience, now)}
                        </span>
                      </div>
                      {(experience.location || experience.contract) && (
                        <p className="text-[13px] text-text-secondary">{[experience.location, experience.contract].filter(Boolean).join(" · ")}</p>
                      )}
                      <JobDetails experience={experience} />
                      {/* Sans compétences saisies, ces technologies remplissent déjà la carte Compétences. */}
                      {profile.skills.length > 0 && experience.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {experience.technologies.map((technology) => (
                            <Chip key={technology}>{technology}</Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {profile.education.length > 0 && (
            <Section icon={GraduationCap} title="Formation">
              {profile.education.map((entry) => (
                <div key={`${entry.degree}-${entry.school}`} className="flex flex-col gap-1 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>
                      <span className="font-medium">{entry.degree}</span> <span className="text-text-secondary">· {entry.school}</span>
                    </span>
                    {entry.year && <span className="text-xs tabular-nums text-text-tertiary">{entry.year}</span>}
                  </div>
                  {entry.details && <p className="text-text-secondary">{entry.details}</p>}
                </div>
              ))}
            </Section>
          )}

          <Entries icon={FolderGit2} title="Projets" items={profile.projects.map((item) => ({ title: item.name, meta: [item.technologies.join(", "), item.year], description: item.description, url: item.url }))} />
          <Entries icon={Award} title="Certifications" items={profile.certifications.map((item) => ({ title: item.name, meta: [item.issuer, item.year], url: item.url }))} />
          <Entries icon={HandHeart} title="Bénévolat" items={profile.volunteering.map((item) => ({ title: item.role, meta: [item.organization, item.start && formatMonth(item.start)], description: item.description }))} />
          <Entries icon={BookOpen} title="Publications" items={profile.publications.map((item) => ({ title: item.title, meta: [item.publisher, item.year], url: item.url }))} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {active.length > 0 && (
            <Section className={SIDE_CARD} icon={Target} title="Ce que je recherche">
              <div className="flex flex-col divide-y divide-border">
                {active.map((search) => (
                  <div key={search.id || search.name} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    {active.length > 1 && <span className="text-sm font-medium">{search.name}</span>}
                    <span className="text-sm text-text-secondary">{search.roles.join(", ")}</span>
                    <span className="text-[13px] text-text-tertiary">
                      {[seniorityLabels[search.seniority], search.contract_types.map((contract) => contractLabels[contract]).join(", "), search.locations.join(", ") || "Partout", remoteLabels[search.remote]].join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {skills.length > 0 && (
            <Section className={SIDE_CARD} icon={Wrench} title="Compétences">
              {skills.map((group) => (
                <div key={group.name} className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-text-secondary">{group.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <Chip key={item}>{item}</Chip>
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {profile.languages.length > 0 && (
            <Section className={SIDE_CARD} icon={Languages} title="Langues">
              {profile.languages.map((language) => (
                <div key={language.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{language.name}</span>
                  <span className="text-[13px] text-text-secondary">{language.level}</span>
                </div>
              ))}
            </Section>
          )}

          {profile.soft_skills.length > 0 && (
            <Section className={SIDE_CARD} icon={Sparkles} title="Qualités">
              <div className="flex flex-wrap gap-1.5">
                {profile.soft_skills.map((item) => (
                  <Chip key={item}>{item}</Chip>
                ))}
              </div>
            </Section>
          )}

          {profile.interests.length > 0 && (
            <Section className={SIDE_CARD} icon={Heart} title="Centres d'intérêt">
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((item) => (
                  <Chip key={item}>{item}</Chip>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
