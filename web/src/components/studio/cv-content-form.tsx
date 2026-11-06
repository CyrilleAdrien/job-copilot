"use client";

import { Award, BookMarked, BookOpen, Briefcase, FolderGit2, GraduationCap, HandHeart, IdCard, Info, ListPlus, Trophy, UserCheck, UserRound, Wrench, type LucideIcon } from "lucide-react";

import { RichEditor } from "@/components/documents/rich-editor";
import { Fold } from "@/components/ui/fold";
import { Input } from "@/components/ui/input";
import type { CvContent } from "@/lib/cv-content";
import { contactLabel } from "@/lib/cv-content";

const SECTION_ICONS: Record<string, LucideIcon> = {
  projects: FolderGit2,
  certifications: Award,
  volunteering: HandHeart,
  publications: BookOpen,
  courses: BookMarked,
  awards: Trophy,
  referees: UserCheck,
};

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-background-subtle p-3">{children}</div>;
}

export function CvContentForm({ content, update }: { content: CvContent; update: (recipe: (draft: CvContent) => void) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Fold title="En-tête" icon={UserRound}>
        <Input label="Titre" value={content.headline} onChange={(event) => update((draft) => void (draft.headline = event.target.value))} />
        {content.contact.map((item, index) => (
          <Input
            key={`${item.kind}-${index}`}
            label={contactLabel(item)}
            value={item.text}
            onChange={(event) => update((draft) => void (draft.contact[index].text = event.target.value))}
          />
        ))}
      </Fold>

      <Fold title="Profil" icon={IdCard}>
        <RichEditor label="Résumé" value={content.summary ?? ""} onChange={(value) => update((draft) => void (draft.summary = value))} />
      </Fold>

      {content.skills.length > 0 && (
        <Fold title="Compétences" icon={Wrench}>
          {content.skills.map((skill, index) => (
            <Panel key={index}>
              <Input label="Catégorie" value={skill.name} onChange={(event) => update((draft) => void (draft.skills[index].name = event.target.value))} />
              <RichEditor
                mode="list"
                label={`Éléments de ${skill.name || "la catégorie"}`}
                value={skill.items.join("\n")}
                onChange={(value) => update((draft) => void (draft.skills[index].items = value.split("\n")))}
              />
            </Panel>
          ))}
        </Fold>
      )}

      {content.experiences.length > 0 && (
        <Fold title="Expériences" icon={Briefcase}>
          {content.experiences.map((experience, index) => (
            <Panel key={index}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Poste" value={experience.title} onChange={(event) => update((draft) => void (draft.experiences[index].title = event.target.value))} />
                <Input label="Dates" value={experience.period} onChange={(event) => update((draft) => void (draft.experiences[index].period = event.target.value))} />
                <Input label="Entreprise" value={experience.company} onChange={(event) => update((draft) => void (draft.experiences[index].company = event.target.value))} />
                <Input label="Lieu" value={experience.location ?? ""} onChange={(event) => update((draft) => void (draft.experiences[index].location = event.target.value || null))} />
              </div>
              <RichEditor label={`Contexte de ${experience.title || "ce poste"}`} value={experience.context ?? ""} onChange={(value) => update((draft) => void (draft.experiences[index].context = value || null))} />
              {experience.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="flex flex-col gap-2">
                  <Input
                    label="Thème"
                    value={group.title ?? ""}
                    onChange={(event) => update((draft) => void (draft.experiences[index].groups[groupIndex].title = event.target.value || null))}
                  />
                  <RichEditor
                    mode="list"
                    label={`Réalisations ${group.title ? `de ${group.title}` : `du thème ${groupIndex + 1}`}`}
                    value={group.bullets.join("\n")}
                    onChange={(value) => update((draft) => void (draft.experiences[index].groups[groupIndex].bullets = value.split("\n")))}
                  />
                </div>
              ))}
            </Panel>
          ))}
        </Fold>
      )}

      {content.education.length > 0 && (
        <Fold title="Formation" icon={GraduationCap}>
          {content.education.map((item, index) => (
            <Panel key={index}>
              <Input label="Diplôme" value={item.degree} onChange={(event) => update((draft) => void (draft.education[index].degree = event.target.value))} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="École" value={item.school} onChange={(event) => update((draft) => void (draft.education[index].school = event.target.value))} />
                <Input label="Lieu" value={item.location ?? ""} onChange={(event) => update((draft) => void (draft.education[index].location = event.target.value || null))} />
                <Input label="Dates" value={item.period ?? ""} onChange={(event) => update((draft) => void (draft.education[index].period = event.target.value || null))} />
              </div>
              <RichEditor label={`Détails de ${item.degree || "la formation"}`} value={item.details ?? ""} onChange={(value) => update((draft) => void (draft.education[index].details = value || null))} />
            </Panel>
          ))}
        </Fold>
      )}

      {content.sections.map((part, index) => (
        <Fold key={part.key ?? index} title={content.titles[part.key ?? ""] ?? part.title} icon={SECTION_ICONS[part.key ?? ""] ?? ListPlus}>
          {part.entries.map((entry, entryIndex) => (
            <Panel key={entryIndex}>
              <Input label="Intitulé" value={entry.title} onChange={(event) => update((draft) => void (draft.sections[index].entries[entryIndex].title = event.target.value))} />
              <Input
                label="Précisions"
                value={entry.meta.join(" · ")}
                onChange={(event) =>
                  update((draft) => void (draft.sections[index].entries[entryIndex].meta = event.target.value ? event.target.value.split(" · ") : []))
                }
              />
              <RichEditor label={`Description de ${entry.title || "cet élément"}`} value={entry.text ?? ""} onChange={(value) => update((draft) => void (draft.sections[index].entries[entryIndex].text = value || null))} />
            </Panel>
          ))}
          {part.bullets.length > 0 && (
            <RichEditor
              mode="list"
              label={`Contenu de ${part.title}`}
              value={part.bullets.join("\n")}
              onChange={(value) => update((draft) => void (draft.sections[index].bullets = value.split("\n")))}
            />
          )}
        </Fold>
      ))}

      {content.extras.length > 0 && (
        <Fold title="Informations complémentaires" icon={Info}>
          {content.extras.map((line, index) => (
            <RichEditor
              mode="line"
              key={line.key ?? index}
              label={content.titles[line.key ?? ""] ?? line.label}
              value={line.text}
              onChange={(value) => update((draft) => void (draft.extras[index].text = value))}
            />
          ))}
        </Fold>
      )}
    </div>
  );
}
