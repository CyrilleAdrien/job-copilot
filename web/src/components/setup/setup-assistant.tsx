"use client";

import { ArrowLeft, ArrowRight, CircleHelp, FlaskConical, ShieldCheck, Wrench } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CalendarSync } from "@/components/calendar/calendar-sync";
import { MailAccounts } from "@/components/mail/mail-accounts";
import { ErrorBanner } from "@/components/profile/error-banner";
import { useProfileIdentity } from "@/components/profile/profile-identity";
import { Hint, ModelPanel, ProfilePanel, SourcesPanel, SystemPanel } from "@/components/settings/settings-panels";
import { SettingsStepItem, STEP_STATES } from "@/components/settings/settings-step";
import { HelpTopicBody } from "@/components/setup/help-topic";
import { useSetup } from "@/components/setup/setup-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { HELP_TOPICS } from "@/lib/help";
import { spring } from "@/lib/motion";
import { chooseMode, isDemo, REQUIRED_STEPS, setupSteps, startDemo, type SetupData } from "@/lib/setup";
import { fetchSearchSettings, type SearchSettings, type Step, type StepId } from "@/lib/system";
import { cn } from "@/lib/utils";

type Stage = "welcome" | StepId;

/** Le premier lancement : choisir entre configurer l'outil et l'essayer, puis chaque étape dans l'ordre. */
export function SetupAssistant() {
  const router = useRouter();
  const { data, refresh } = useSetup();
  const identity = useProfileIdentity();
  const [stage, setStage] = useState<Stage | null>(null);
  const [busy, setBusy] = useState<"demo" | "finish" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const started = useRef(false);
  const [fresh, setFresh] = useState(false);

  // L'assistant relit tout à l'ouverture et attend cette lecture : le contexte peut dater de
  // l'écran précédent (par exemple, d'avant l'import du profil).
  useEffect(() => {
    refresh().finally(() => setFresh(true));
  }, [refresh]);

  useEffect(() => {
    if (!fresh || !data || started.current) return;
    started.current = true;
    if (isDemo(data.mode)) {
      router.replace("/");
      return;
    }
    // Déjà commencé (profil rempli ou mode choisi) : reprendre à la première étape qui attend.
    const steps = setupSteps(data);
    const pending = steps.find((step) => step.state === "todo" || step.state === "error");
    const begun = data.mode?.mode === "real" || data.profile !== null;
    setStage(begun ? (pending?.id ?? "systeme") : "welcome");
  }, [fresh, data, router]);

  async function run(kind: "demo" | "finish", action: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
      await Promise.all([refresh(), identity.refresh()]);
      router.push("/");
    } catch (e) {
      setError(e as ApiError);
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col gap-8 py-6">
      <header className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <Image src="/icon.svg" alt="" width={28} height={28} unoptimized />
          <span className="text-[22px] leading-none">job-copilot</span>
        </span>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/aide">
            <CircleHelp aria-hidden />
            Aide
          </Link>
        </Button>
      </header>

      {error && <ErrorBanner error={error} />}

      {!fresh || !data || stage === null ? (
        <Skeleton className="h-[420px] rounded-card" aria-label="Chargement de la configuration" />
      ) : stage === "welcome" ? (
        <Welcome
          busy={busy}
          onConfigure={() => setStage("systeme")}
          onDemo={() => run("demo", startDemo)}
        />
      ) : (
        <Steps data={data} stage={stage} onStage={setStage} finishing={busy === "finish"} onFinish={() => run("finish", () => chooseMode("real"))} onReload={refresh} />
      )}
    </div>
  );
}

function Welcome({ busy, onConfigure, onDemo }: { busy: "demo" | "finish" | null; onConfigure: () => void; onDemo: () => void }) {
  return (
    <motion.section aria-labelledby="welcome-title" className="flex flex-col gap-8" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.smooth}>
      <div className="hero flex flex-col gap-2 rounded-[20px] bg-accent-soft px-8 py-10 lg:px-11">
        <h1 id="welcome-title" className="text-4xl font-normal leading-tight">
          Bienvenue dans job-copilot
        </h1>
        <p className="max-w-2xl text-base text-text-secondary">
          L&apos;outil cherche les offres faites pour toi, prépare un CV et une lettre sur mesure, puis suit chaque candidature jusqu&apos;à l&apos;entretien. Commence par choisir comment l&apos;utiliser.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Choice
          icon={<Wrench className="size-5" strokeWidth={1.5} aria-hidden />}
          title="Configurer l'outil"
          description="Ton profil, le modèle d'IA, tes sources d'offres et, si tu veux, ta boîte mail et ton calendrier. Comptes environ 15 minutes, téléchargement du modèle compris."
          action={
            <Button onClick={onConfigure} disabled={busy !== null}>
              Commencer
              <ArrowRight aria-hidden />
            </Button>
          }
        />
        <Choice
          icon={<FlaskConical className="size-5" strokeWidth={1.5} aria-hidden />}
          title="Essayer en démonstration"
          description="Un profil d'exemple, des offres, des réponses de recruteurs et un calendrier fictifs, sans compte ni IA. Tu pourras ensuite passer à tes vrais comptes : les données fictives seront effacées."
          action={
            <Button variant="secondary" loading={busy === "demo"} disabled={busy !== null} onClick={onDemo}>
              Lancer la démonstration
            </Button>
          }
        />
      </div>

      <p className="flex items-center gap-2 text-[13px] text-text-secondary">
        <ShieldCheck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        Tout reste sur ton ordinateur : profil, mails, candidatures. Aucun compte job-copilot n&apos;est nécessaire.
      </p>
    </motion.section>
  );
}

function Choice({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action: React.ReactNode }) {
  return (
    <Card className="group flex flex-col gap-4 p-6 hover:border-text">
      <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft transition-transform duration-150 group-hover:scale-110">{icon}</span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-normal">{title}</h2>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
      <div className="mt-auto">{action}</div>
    </Card>
  );
}

function Steps({
  data,
  stage,
  onStage,
  finishing,
  onFinish,
  onReload,
}: {
  data: SetupData;
  stage: StepId;
  onStage: (stage: Stage) => void;
  finishing: boolean;
  onFinish: () => void;
  onReload: () => Promise<void>;
}) {
  const steps = setupSteps(data);
  const index = Math.max(0, steps.findIndex((step) => step.id === stage));
  const step = steps[index];
  const topic = HELP_TOPICS.find((item) => item.id === step.id);
  const required = REQUIRED_STEPS.includes(step.id);
  const blocked = required && step.state !== "ready";
  const last = index === steps.length - 1;
  const essentials = steps.filter((item) => REQUIRED_STEPS.includes(item.id));
  const essentialsReady = essentials.every((item) => item.state === "ready");
  const readyCount = essentials.filter((item) => item.state === "ready").length;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <nav aria-label="Étapes de la configuration" className="flex flex-col gap-3 lg:sticky lg:top-4">
        <div className="flex flex-col gap-2 px-3">
          <p role="status" className="text-[13px] text-text-secondary">
            {readyCount} étape{readyCount > 1 ? "s" : ""} indispensable{readyCount > 1 ? "s" : ""} prête{readyCount > 1 ? "s" : ""} sur {essentials.length}
          </p>
          <div aria-hidden className="h-1 overflow-hidden rounded-full bg-surface-hover">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${(readyCount / essentials.length) * 100}%` }}
              transition={spring.smooth}
            />
          </div>
        </div>
        <ol className="flex flex-col gap-1">
          {steps.map((item, position) => (
            <SettingsStepItem key={item.id} step={item} number={position + 1} selected={item.id === step.id} last={position === steps.length - 1} onSelect={() => onStage(item.id)} />
          ))}
        </ol>
      </nav>

      <Card className="min-w-0 overflow-hidden hover:border-border">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section key={step.id} aria-labelledby="setup-step-title" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.14 }}>
            <header className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px] text-text-tertiary">
                  Étape {index + 1} sur {steps.length} · {required ? "indispensable" : "facultative"}
                </span>
                <h1 id="setup-step-title" className="text-2xl font-normal">
                  {step.title}
                </h1>
                <p className="break-words text-sm text-text-secondary">{step.summary}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs", STEP_STATES[step.state].className)}>{STEP_STATES[step.state].label}</span>
            </header>

            <div className="grid gap-8 p-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              {topic && (
                <section aria-label="Comment faire">
                  <HelpTopicBody topic={topic} />
                </section>
              )}
              <section aria-label="Configurer" className="min-w-0">
                <StepPanel step={step} data={data} onReload={onReload} />
              </section>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-6">
              <Button variant="ghost" onClick={() => onStage(index === 0 ? "welcome" : steps[index - 1].id)}>
                <ArrowLeft aria-hidden />
                Précédent
              </Button>
              <div className="flex flex-wrap items-center gap-3">
                {blocked && <span className="text-[13px] text-text-secondary">Termine cette étape pour continuer.</span>}
                {!required && step.state !== "ready" && !last && (
                  <Button variant="ghost" onClick={() => onStage(steps[index + 1].id)}>
                    Passer
                  </Button>
                )}
                {last ? (
                  <Button loading={finishing} disabled={!essentialsReady} onClick={onFinish} title={essentialsReady ? undefined : "Les étapes indispensables ne sont pas toutes prêtes."}>
                    Terminer
                    <ArrowRight aria-hidden />
                  </Button>
                ) : (
                  <Button disabled={blocked} onClick={() => onStage(steps[index + 1].id)}>
                    Continuer
                    <ArrowRight aria-hidden />
                  </Button>
                )}
              </div>
            </footer>
          </motion.section>
        </AnimatePresence>
      </Card>
    </div>
  );
}

/** Le formulaire de l'étape : les mêmes que dans Réglages. */
function StepPanel({ step, data, onReload }: { step: Step; data: SetupData; onReload: () => Promise<void> }) {
  const [search, setSearch] = useState<SearchSettings | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    fetchSearchSettings().then(setSearch, () => setSearch(null));
  }, []);

  async function recheck() {
    setChecking(true);
    await onReload();
    setChecking(false);
  }

  const reload = () => void onReload();

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner error={error} />}
      {step.state === "locked" ? (
        <Hint>{step.summary}</Hint>
      ) : step.id === "systeme" ? (
        <SystemPanel status={data.status} encryption={search?.encryption ?? null} busy={checking} onRefresh={recheck} />
      ) : step.id === "modele" ? (
        <ModelPanel llm={data.llm} onChange={reload} />
      ) : step.id === "profil" ? (
        <ProfilePanel profile={data.profile} returnTo="/configuration" />
      ) : step.id === "sources" ? (
        data.sources ? <SourcesPanel sources={data.sources} search={search} onChange={reload} onSearchChange={setSearch} /> : <Hint>Le service des offres ne répond pas.</Hint>
      ) : step.id === "boite-mail" ? (
        data.mail ? <MailAccounts accounts={data.mail} onChange={reload} onError={(e) => setError(e as ApiError)} /> : <Hint>Le service mail ne répond pas.</Hint>
      ) : step.id === "calendrier" ? (
        data.calendar ? <CalendarSync account={data.calendar[0] ?? null} onChange={reload} /> : <Hint>Le service calendrier ne répond pas.</Hint>
      ) : null}
    </div>
  );
}
