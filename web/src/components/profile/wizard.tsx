"use client";

import { ArrowLeft, ArrowRight, Check, FileUp, PenLine } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { ImportButton } from "@/components/profile/import-button";
import { ProfileView } from "@/components/profile/profile-view";
import { SearchPicker } from "@/components/profile/search-picker";
import {
  BackgroundStep,
  ExperiencesStep,
  IdentityStep,
  SearchStep,
  SkillsStep,
  type StepProps,
} from "@/components/profile/steps";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, fetchProfile, saveProfile } from "@/lib/api";
import { spring } from "@/lib/motion";
import {
  addSearch,
  applyCvView,
  cvView,
  emptyProfile,
  firstActiveSearch,
  toPayload,
  validateBackground,
  validateExperiences,
  validateIdentity,
  validateSearch,
  type CvView,
  type Profile,
  type StepErrors,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  label: string;
  title: string;
  description: string;
  /** Une étape du CV : elle agit sur la recherche choisie. */
  Cv?: (props: StepProps) => React.ReactNode;
  validate?: (profile: Profile) => StepErrors;
  validateCv?: (view: CvView) => StepErrors;
};

const steps: Step[] = [
  { id: "identity", label: "Identité", title: "Qui es-tu ?", description: "Commun à tous tes CV : ton nom, tes coordonnées et tes liens.", validate: validateIdentity },
  { id: "search", label: "Recherches", title: "Ce que tu recherches", description: "Une ou plusieurs recherches : chacune a ses offres et son propre CV. Une nouvelle recherche part de zéro ou d'une copie.", validate: validateSearch },
  { id: "experiences", label: "Expériences", title: "Le CV de cette recherche", description: "Son titre, son résumé et ses expériences. L'IA choisit et reformule parmi elles, sans jamais rien inventer.", Cv: ExperiencesStep, validateCv: validateExperiences },
  { id: "skills", label: "Compétences", title: "Compétences et langues", description: "Les compétences par catégorie et le savoir-être de ce CV. Les langues sont communes à tous tes CV.", Cv: SkillsStep },
  { id: "background", label: "Parcours", title: "Formation et parcours", description: "Formation, certifications, projets, bénévolat, publications, récompenses, références et sections libres de ce CV. Tout est facultatif.", Cv: BackgroundStep, validateCv: validateBackground },
  { id: "review", label: "Récapitulatif", title: "Tout est prêt", description: "Vérifie chaque CV avant de l'enregistrer." },
];

export function ProfileWizard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [focus, setFocus] = useState<number | undefined>(undefined);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<StepErrors>({});
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  // Profil déjà enregistré : on navigue librement entre les étapes et on peut enregistrer à tout moment.
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Liens de la page Profil : ?recherche=nouvelle ou ?recherche=<id> ouvrent l'étape Recherches
    // sur une nouvelle recherche, vide ou copiée de celle indiquée ; ?modifier=<id> sur une existante.
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("recherche");
    const edited = params.get("modifier");
    const shown = params.get("cv");
    fetchProfile()
      .then((existing) => {
        const loaded = existing ?? emptyProfile();
        const position = (id: string | null) => loaded.searches.findIndex((search) => search.id === id);
        setActive(position(shown) >= 0 ? position(shown) : firstActiveSearch(loaded));
        if (existing && wanted) {
          setFocus(addSearch(loaded, wanted === "nouvelle" ? undefined : wanted));
          setCurrent(steps.findIndex((step) => step.id === "search"));
        } else if (existing && edited) {
          setFocus(Math.max(0, position(edited)));
          setCurrent(steps.findIndex((step) => step.id === "search"));
        }
        setProfile(loaded);
        setStarted(existing !== null);
        setEditing(existing !== null);
      })
      .catch((error: ApiError) => {
        setProfile(emptyProfile());
        setApiError(error);
      });
  }, []);

  if (!profile) return <WizardSkeleton />;

  const update: StepProps<Profile>["update"] = (recipe) =>
    setProfile((previous) => {
      const draft = structuredClone(previous!);
      recipe(draft);
      return draft;
    });

  const searchIndex = Math.min(active, profile.searches.length - 1);
  const updateCv: StepProps["update"] = (recipe) =>
    setProfile((previous) => {
      const draft = cvView(structuredClone(previous!), searchIndex);
      recipe(draft);
      return applyCvView(draft, searchIndex);
    });

  const stepErrorsFor = (item: Step, index: number) =>
    item.validateCv?.(cvView(profile, index)) ?? item.validate?.(profile) ?? {};

  const go = (target: number) => {
    if (target > current && !editing) {
      const stepErrors = stepErrorsFor(steps[current], searchIndex);
      setErrors(stepErrors);
      if (Object.keys(stepErrors).length) return;
    }
    setDirection(target > current ? 1 : -1);
    setCurrent(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    // Toutes les étapes sont vérifiées : on ouvre la première qui a une erreur.
    for (const [index, item] of steps.entries()) {
      // Les étapes du CV sont vérifiées pour chaque recherche : on ouvre celle qui a une erreur.
      const targets = item.validateCv ? profile.searches.map((_, position) => position) : [searchIndex];
      for (const target of targets) {
        const stepErrors = stepErrorsFor(item, target);
        if (Object.keys(stepErrors).length) {
          setErrors(stepErrors);
          setActive(target);
          setDirection(index > current ? 1 : -1);
          setCurrent(index);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }
    }
    setErrors({});
    setSaving(true);
    setApiError(null);
    try {
      await saveProfile(toPayload(profile));
      router.push("/profil");
    } catch (error) {
      setApiError(error instanceof ApiError ? error : new ApiError("Enregistrement impossible.", 0));
      setSaving(false);
    }
  };

  if (!started) {
    return (
      <Welcome
        onStart={() => setStarted(true)}
        onImported={() => router.push("/profil")}
        onError={setApiError}
        error={apiError}
      />
    );
  }

  const step = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <div className="flex flex-col gap-8">
      <StepIndicator
        current={current}
        free={editing}
        onSelect={(index) => (editing || index < current) && index !== current && go(index)}
      />

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.section
          key={step.id}
          custom={direction}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={spring.smooth}
          className="flex flex-col gap-6"
        >
          <header className="flex flex-col gap-1">
            <h1 className="text-[28px] font-medium leading-tight">{step.title}</h1>
            <p className="text-[15px] text-text-secondary">{step.description}</p>
          </header>
          {(step.Cv || step.id === "review") && (
            <SearchPicker label="CV de la recherche" searches={profile.searches} value={searchIndex} onChange={setActive} />
          )}
          {step.id === "identity" ? (
            <IdentityStep profile={profile} update={update} errors={errors} />
          ) : step.id === "search" ? (
            <SearchStep profile={profile} update={update} errors={errors} focus={focus ?? searchIndex} onSelect={setActive} />
          ) : step.Cv ? (
            <step.Cv key={searchIndex} profile={cvView(profile, searchIndex)} update={updateCv} errors={errors} />
          ) : (
            <ProfileView profile={cvView(toPayload(profile), searchIndex)} />
          )}
        </motion.section>
      </AnimatePresence>

      <AnimatePresence>{apiError && <ErrorBanner error={apiError} />}</AnimatePresence>

      <footer className="sticky bottom-0 -mx-1 flex items-center justify-between border-t border-border bg-background/85 px-1 py-4 backdrop-blur-xl">
        <Button variant="ghost" onClick={() => go(current - 1)} disabled={current === 0}>
          <ArrowLeft aria-hidden />
          Retour
        </Button>
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="ghost" asChild>
              <Link href="/profil">Annuler</Link>
            </Button>
          )}
          {editing && !isLast && (
            <Button variant="secondary" onClick={save} loading={saving}>
              <Check aria-hidden />
              Enregistrer
            </Button>
          )}
          {isLast ? (
            <Button variant="accent" onClick={save} loading={saving}>
              <Check aria-hidden />
              Enregistrer mon profil
            </Button>
          ) : (
            <Button onClick={() => go(current + 1)}>
              Continuer
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function StepIndicator({
  current,
  free,
  onSelect,
}: {
  current: number;
  /** Toutes les étapes sont accessibles (modification d'un profil existant). */
  free: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Étapes">
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "active" : "pending";
        return (
          <li key={step.id} className="flex flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={() => onSelect(index)}
              disabled={free ? state === "active" : state !== "done"}
              aria-current={state === "active" ? "step" : undefined}
              className="group flex flex-col gap-2 text-left disabled:cursor-default"
            >
              <span className="relative h-1 overflow-hidden rounded-full bg-surface-hover">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  initial={false}
                  animate={{ width: state === "pending" ? "0%" : "100%" }}
                  transition={spring.gentle}
                />
              </span>
              <span
                className={cn(
                  "text-xs font-medium transition-colors",
                  state === "pending" ? "text-text-tertiary" : "text-text",
                  (state === "done" || (free && state === "pending")) && "group-hover:text-accent-strong",
                )}
              >
                {step.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Welcome({
  onStart,
  onImported,
  onError,
  error,
}: {
  onStart: () => void;
  onImported: () => void;
  onError: (error: ApiError) => void;
  error: ApiError | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-medium leading-tight">Bienvenue sur job-copilot</h1>
        <p className="max-w-xl text-[15px] text-text-secondary">
          Configure ton profil une fois : il sert à trouver les offres qui te correspondent et à rédiger tes CV et
          lettres. Tout reste sur ton ordinateur.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Choice
          icon={PenLine}
          title="Remplir mon profil"
          description="Cinq étapes courtes : identité, recherches, expériences, compétences, parcours."
          action={
            <Button onClick={onStart}>
              Commencer
              <ArrowRight aria-hidden />
            </Button>
          }
        />
        <Choice
          icon={FileUp}
          title="Importer un fichier"
          description="Tu as déjà un profile.yaml, exporté ou écrit à la main à partir de l'exemple."
          action={<ImportButton variant="secondary" onImported={onImported} onError={onError} />}
        />
      </div>
      <AnimatePresence>{error && <ErrorBanner error={error} />}</AnimatePresence>
    </div>
  );
}

function Choice({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof PenLine;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="transition-colors hover:border-border-strong">
      <CardContent className="flex h-full flex-col gap-4">
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-accent-soft text-accent-strong">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-[15px] font-medium">{title}</h2>
          <p className="text-sm text-text-secondary">{description}</p>
        </div>
        <div>{action}</div>
      </CardContent>
    </Card>
  );
}

function WizardSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <div className="flex gap-2">
        {steps.map((step) => (
          <Skeleton key={step.id} className="h-1 flex-1 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    </div>
  );
}
