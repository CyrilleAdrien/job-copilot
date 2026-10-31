import {
  ArchiveRestore,
  Award,
  BookOpen,
  Briefcase,
  FolderGit2,
  GraduationCap,
  HandHeart,
  Languages,
  MapPin,
  Target,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  contractLabels,
  matchModeLabels,
  maxAgeLabels,
  remoteLabels,
  seniorityLabels,
  type Profile,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" });

export function formatMonth(value?: string | null) {
  if (!value) return "aujourd'hui";
  const [year, month] = value.split("-").map(Number);
  return monthFormatter.format(new Date(year, month - 1));
}

/** Lecture seule du profil, utilisée par l'écran Profil et le récapitulatif de l'assistant. */
export function ProfileView({ profile, onRestore }: { profile: Profile; onRestore?: (id: string) => void }) {
  const { identity } = profile;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-semibold tracking-tight">{identity.full_name}</h2>
            <p className="text-[15px] text-text-secondary">{identity.headline}</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
            {identity.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {identity.location}
              </span>
            )}
            {identity.email && <span>{identity.email}</span>}
            {identity.phone && <span>{identity.phone}</span>}
            {identity.availability && <span>{identity.availability}</span>}
          </div>
          {identity.summary && <p className="text-sm leading-relaxed">{identity.summary}</p>}
        </CardContent>
      </Card>

      <Section icon={Target} title={profile.searches.length > 1 ? "Mes recherches" : "Ce que je recherche"}>
        <div className="flex flex-col divide-y divide-border">
          {profile.searches.map((search) => {
            const skills = search.focus_skills.length ? search.focus_skills : search.technologies;
            return (
              <div key={search.id || search.name} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                {profile.searches.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", search.archived && "text-text-secondary")}>{search.name}</span>
                    {search.archived && <Badge>Archivée</Badge>}
                    {search.archived && onRestore && (
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onRestore(search.id)}>
                        <ArchiveRestore aria-hidden />
                        Restaurer
                      </Button>
                    )}
                  </div>
                )}
                <Row label="Postes">{search.roles.join(", ")}</Row>
                {search.technologies.length > 0 && <Row label="Technos">{search.technologies.join(", ")}</Row>}
                <Row label="Offres">
                  {search.match_mode === "domain"
                    ? matchModeLabels.domain
                    : `Au moins ${Math.min(search.min_skills, skills.length)} parmi ${skills.join(", ")}`}
                </Row>
                <Row label="Niveau">{seniorityLabels[search.seniority]}</Row>
                <Row label="Contrat">{search.contract_types.map((c) => contractLabels[c]).join(", ")}</Row>
                <Row label="Lieu">
                  {[search.locations.join(", ") || "Partout", `${search.radius_km} km`, remoteLabels[search.remote]].join(" · ")}
                </Row>
                {search.salary_min ? <Row label="Salaire min.">{search.salary_min.toLocaleString("fr-FR")} €</Row> : null}
                <Row label="Offres publiées depuis">{maxAgeLabels[search.max_age_days]}</Row>
                {search.excluded_keywords.length > 0 && <Row label="Exclure">{search.excluded_keywords.join(", ")}</Row>}
              </div>
            );
          })}
        </div>
      </Section>

      {profile.experiences.length > 0 && (
        <Section icon={Briefcase} title="Expériences">
          <div className="flex flex-col divide-y divide-border">
            {profile.experiences.map((experience, index) => (
              <div key={index} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {experience.title} <span className="text-text-secondary">· {experience.company}</span>
                  </span>
                  <span className="text-xs tabular-nums text-text-tertiary">
                    {formatMonth(experience.start)} – {formatMonth(experience.end)}
                  </span>
                </div>
                <span className="text-xs text-text-tertiary">
                  {experience.groups.reduce((count, group) => count + group.bullets.length, 0)} réalisations
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {profile.skills.length > 0 && (
        <Section icon={Wrench} title="Compétences">
          {profile.skills.map((category) => (
            <Row key={category.name} label={category.name}>
              <span className="flex flex-wrap gap-1.5">
                {category.items.map((item) => (
                  <Badge key={item}>{item}</Badge>
                ))}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {(profile.education.length > 0 || profile.languages.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {profile.education.length > 0 && (
            <Section icon={GraduationCap} title="Formation">
              {profile.education.map((entry, index) => (
                <div key={index} className="flex flex-col text-sm">
                  <span className="font-medium">{entry.degree}</span>
                  <span className="text-text-secondary">
                    {entry.school}
                    {entry.year ? ` · ${entry.year}` : ""}
                  </span>
                </div>
              ))}
            </Section>
          )}
          {profile.languages.length > 0 && (
            <Section icon={Languages} title="Langues">
              {profile.languages.map((language) => (
                <Row key={language.name} label={language.name}>
                  {language.level}
                </Row>
              ))}
            </Section>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Entries
          icon={Award}
          title="Certifications"
          items={profile.certifications.map((item) => ({ title: item.name, meta: [item.issuer, item.year] }))}
        />
        <Entries
          icon={FolderGit2}
          title="Projets"
          items={profile.projects.map((item) => ({ title: item.name, meta: [item.technologies.join(", "), item.year] }))}
        />
        <Entries
          icon={HandHeart}
          title="Bénévolat"
          items={profile.volunteering.map((item) => ({ title: item.role, meta: [item.organization, item.start && formatMonth(item.start)] }))}
        />
        <Entries
          icon={BookOpen}
          title="Publications"
          items={profile.publications.map((item) => ({ title: item.title, meta: [item.publisher, item.year] }))}
        />
      </div>
    </div>
  );
}

function Entries({
  icon,
  title,
  items,
}: {
  icon: typeof Target;
  title: string;
  items: { title: string; meta: (string | number | null | undefined)[] }[];
}) {
  if (!items.length) return null;
  return (
    <Section icon={icon} title={title}>
      {items.map((item, index) => (
        <div key={index} className="flex flex-col text-sm">
          <span className="font-medium">{item.title}</span>
          {item.meta.some(Boolean) && <span className="text-text-secondary">{item.meta.filter(Boolean).join(" · ")}</span>}
        </div>
      ))}
    </Section>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon className="size-4 text-text-tertiary" strokeWidth={1.75} aria-hidden />
          {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-sm md:grid-cols-[160px_1fr]">
      <span className="text-text-secondary">{label}</span>
      <span>{children}</span>
    </div>
  );
}
