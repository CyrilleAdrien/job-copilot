"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { DocumentViewer } from "@/components/documents/document-viewer";
import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { StepProgress } from "@/components/ui/step-progress";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api";
import {
  currentStep,
  eventsUrl,
  fetchGeneration,
  fetchGenerations,
  fetchLLMStatus,
  startGeneration,
  type Generation,
  type Language,
  type LLMStatus,
} from "@/lib/documents";
import { fadeUp, spring } from "@/lib/motion";

type LanguageChoice = "auto" | Language;

const languages: { value: LanguageChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
];

/** Génération du CV et de la lettre pour une offre : options, progression en direct, aperçu. */
export function GenerationPanel({ offerId }: { offerId: number }) {
  const [generation, setGeneration] = useState<Generation | null | undefined>(undefined);
  const [configuring, setConfiguring] = useState(false);
  const [llm, setLlm] = useState<LLMStatus | null>(null);
  const [withLetter, setWithLetter] = useState(true);
  const [language, setLanguage] = useState<LanguageChoice>("auto");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [previousError, setPreviousError] = useState<string | null>(null);

  useEffect(() => {
    fetchGenerations(offerId)
      .then((list) => {
        // Un échec passé ne bloque pas : on repart des options, avec le message en rappel.
        const last = list[0] ?? null;
        if (last?.status === "error") setPreviousError(last.error);
        setGeneration(last?.status === "error" ? null : last);
      })
      .catch((e: ApiError) => {
        setError(e);
        setGeneration(null);
      });
    fetchLLMStatus()
      .then(setLlm)
      .catch(() => setLlm(null));
  }, [offerId]);

  // Suit la génération en cours par SSE ; en cas de coupure, relit l'état une fois.
  const runningId = generation?.status === "running" ? generation.id : null;
  useEffect(() => {
    if (!runningId) return;
    const source = new EventSource(eventsUrl(runningId));
    const update = (event: MessageEvent) => setGeneration(JSON.parse(event.data));
    source.addEventListener("progress", update);
    source.addEventListener("done", (event) => {
      update(event as MessageEvent);
      source.close();
    });
    source.addEventListener("error", (event) => {
      source.close();
      if (event instanceof MessageEvent && event.data) update(event);
      else fetchGeneration(runningId).then(setGeneration).catch(setError);
    });
    return () => source.close();
  }, [runningId]);

  async function generate() {
    setStarting(true);
    setError(null);
    try {
      const started = await startGeneration(offerId, {
        letter: withLetter,
        language: language === "auto" ? null : language,
      });
      setGeneration(started);
      setConfiguring(false);
      setPreviousError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setStarting(false);
    }
  }

  const missingModel = llm !== null && !llm.ready;
  const view =
    generation === undefined
      ? "loading"
      : configuring || generation === null
        ? "options"
        : generation.status;

  return (
    <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card">
      <header className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-ai-soft text-ai-strong">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="flex flex-col">
          <h2 className="text-[15px] font-semibold tracking-tight">CV et lettre</h2>
          <p className="text-[13px] text-text-secondary">
            Adaptés à cette offre, à partir de ton profil uniquement.
          </p>
        </div>
      </header>

      <AnimatePresence>{error && <ErrorBanner error={error} />}</AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} {...fadeUp} transition={spring.smooth} className="flex flex-col gap-5">
          {view === "loading" && (
            <div className="flex flex-col gap-3" aria-busy>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-9 w-48 rounded-full" />
            </div>
          )}

          {view === "options" && (
            <>
              <Switch
                checked={withLetter}
                onChange={setWithLetter}
                label="Lettre de motivation"
                description="À générer si l'offre en demande une."
              />
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Langue</span>
                  <span className="text-[13px] text-text-secondary">
                    Auto : celle de l&apos;offre.
                  </span>
                </div>
                <SegmentedControl
                  label="Langue des documents"
                  segments={languages}
                  value={language}
                  onChange={setLanguage}
                />
              </div>
              {previousError && (
                <p className="text-[13px] text-text-tertiary">
                  Dernière tentative : {previousError}
                </p>
              )}
              {missingModel && (
                <p className="rounded-[10px] bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
                  Le modèle {llm?.model} n&apos;est pas encore téléchargé. Lance{" "}
                  <code>make models</code>, puis réessaie.
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button variant="ai" onClick={generate} loading={starting} disabled={missingModel}>
                  <Sparkles aria-hidden />
                  {withLetter ? "Générer le CV et la lettre" : "Générer le CV"}
                </Button>
                {generation && (
                  <Button variant="ghost" onClick={() => setConfiguring(false)}>
                    Annuler
                  </Button>
                )}
              </div>
            </>
          )}

          {view === "running" && generation && <Progress generation={generation} />}

          {view === "error" && generation && (
            <>
              <ErrorBanner error={new ApiError(generation.error ?? "La génération a échoué.", 500)} />
              <Button variant="secondary" className="w-fit" onClick={() => setGeneration(null)}>
                <RotateCcw aria-hidden />
                Réessayer
              </Button>
            </>
          )}

          {view === "done" && generation && (
            <DocumentViewer
              generation={generation}
              onChange={setGeneration}
              onRegenerate={() => setConfiguring(true)}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Progress({ generation }: { generation: Generation }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.round((Date.now() - new Date(generation.created_at).getTime()) / 1000)),
  );
  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <StepProgress
        steps={generation.steps.map((step) => ({ id: step.key, label: step.label }))}
        current={currentStep(generation)}
      />
      <p className="text-[13px] text-text-tertiary" aria-live="polite">
        {elapsed} s · le modèle tourne sur ton ordinateur : quelques secondes avec une carte graphique,
        plusieurs minutes sur processeur seul.
      </p>
    </div>
  );
}
