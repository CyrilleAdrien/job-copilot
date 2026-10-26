import { ArrowRight, Inbox, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  DateWindowDemo,
  FormDemo,
  GenerationDemo,
  SkeletonDemo,
  StatsDemo,
} from "@/components/design/demos";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { applicationStatuses, type ApplicationStatus } from "@/lib/statuses";

export const metadata: Metadata = { title: "Design system" };

const colors = [
  { name: "Fond", token: "background", className: "bg-background" },
  { name: "Surface atténuée", token: "background-subtle", className: "bg-background-subtle" },
  { name: "Texte", token: "text", className: "bg-text" },
  { name: "Texte secondaire", token: "text-secondary", className: "bg-text-secondary" },
  { name: "Accent", token: "accent", className: "bg-accent" },
  { name: "Accent fort", token: "accent-strong", className: "bg-accent-strong" },
  { name: "IA", token: "ai", className: "bg-ai" },
  { name: "Succès", token: "success", className: "bg-success" },
  { name: "Attente", token: "warning", className: "bg-warning" },
  { name: "Refus", token: "danger", className: "bg-danger" },
];

const typeScale = [
  { label: "Titre de page", className: "text-[28px] font-semibold tracking-tight", size: "28 / 600" },
  { label: "Titre de section", className: "text-xl font-semibold tracking-tight", size: "20 / 600" },
  { label: "Titre de carte", className: "text-[15px] font-semibold", size: "15 / 600" },
  { label: "Texte courant", className: "text-sm", size: "14 / 400" },
  { label: "Légende", className: "text-xs text-text-secondary", size: "12 / 400" },
];

export default function DesignPage() {
  return (
    <>
      <PageHeader
        title="Design system"
        description="Tokens, composants et animations utilisés par toute l'application."
      />
      <div className="flex flex-col gap-14">
        <Section title="Couleurs" description="Blanc et bleu pour l'interface, violet réservé à l'IA.">
          <div className="grid grid-cols-5 gap-3">
            {colors.map((color) => (
              <div key={color.token} className="flex flex-col gap-2">
                <div className={`h-16 rounded-[10px] border border-border ${color.className}`} />
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">{color.name}</span>
                  <code className="text-xs text-text-tertiary">--{color.token}</code>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typographie" description="Inter, cinq tailles, chiffres tabulaires.">
          <div className="flex flex-col divide-y divide-border rounded-card border border-border">
            {typeScale.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between px-5 py-4">
                <span className={item.className}>{item.label}</span>
                <code className="text-xs text-text-tertiary">{item.size}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Boutons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <Plus aria-hidden />
              Nouvelle candidature
            </Button>
            <Button variant="accent">
              Postuler
              <ArrowRight aria-hidden />
            </Button>
            <Button variant="ai">
              <Sparkles aria-hidden />
              Générer le CV
            </Button>
            <Button variant="secondary">Annuler</Button>
            <Button variant="ghost">Plus tard</Button>
            <Button variant="danger">Supprimer</Button>
            <Tooltip content="Disponible quand le profil est complet">
              <span tabIndex={0}>
                <Button disabled>Désactivé</Button>
              </span>
            </Tooltip>
          </div>
        </Section>

        <Section title="Statuts de candidature">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(applicationStatuses) as ApplicationStatus[]).map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
            <Badge tone="ai">
              <Sparkles aria-hidden />
              Pertinence 92 %
            </Badge>
          </div>
        </Section>

        <Section title="Champs de saisie">
          <FormDemo />
        </Section>

        <Section
          title="Filtre de date de publication"
          description="Contrôle à segments : la pastille glisse vers l'option choisie."
        >
          <DateWindowDemo />
        </Section>

        <Section
          title="Chargement"
          description="Des squelettes au contour exact du contenu, jamais un indicateur seul sur une page vide."
        >
          <SkeletonDemo />
        </Section>

        <Section
          title="Tâche longue"
          description="Les étapes réelles de la génération, diffusées en direct par le serveur."
        >
          <div className="max-w-md">
            <GenerationDemo />
          </div>
        </Section>

        <Section title="Indicateurs" description="Les compteurs montent à leur valeur à l'affichage.">
          <StatsDemo />
        </Section>

        <Section title="État vide">
          <EmptyState
            icon={Inbox}
            title="Aucune réponse pour l'instant"
            description="Les réponses des recruteurs apparaîtront ici dès que ta boîte mail sera connectée."
            action={<Button variant="secondary">Connecter ma boîte mail</Button>}
          />
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}
