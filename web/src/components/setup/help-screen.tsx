"use client";

import { ArrowRight, Settings2, Sparkles } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { STEP_STATES } from "@/components/settings/settings-step";
import { HelpTopicBody } from "@/components/setup/help-topic";
import { useSetup } from "@/components/setup/setup-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HELP_FAQ, HELP_TOPICS } from "@/lib/help";
import { isDemo, REQUIRED_STEPS, setupSteps } from "@/lib/setup";
import { cn } from "@/lib/utils";

/** La documentation dans l'application : les étapes de configuration dans l'ordre, avec leur état. */
export function HelpScreen() {
  const { data } = useSetup();
  const steps = data ? setupSteps(data) : [];
  const state = (id: string) => steps.find((step) => step.id === id);
  const ready = steps.filter((step) => REQUIRED_STEPS.includes(step.id) && step.state === "ready").length;

  return (
    <>
      <PageHeader
        title="Aide"
        description="Configurer job-copilot étape par étape : chacune débloque une partie de l'application."
        actions={
          <Button asChild>
            <Link href="/configuration">
              <Sparkles aria-hidden />
              Ouvrir l&apos;assistant
            </Link>
          </Button>
        }
      />

      <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Sommaire de l'aide" className="flex flex-col gap-1 lg:sticky lg:top-4">
          {data && !isDemo(data.mode) && (
            <p role="status" className="px-3 pb-2 text-[13px] text-text-secondary">
              {ready} étape{ready > 1 ? "s" : ""} essentielle{ready > 1 ? "s" : ""} prête{ready > 1 ? "s" : ""} sur {REQUIRED_STEPS.length}
            </p>
          )}
          {HELP_TOPICS.map((topic, index) => (
            <a key={topic.id} href={`#${topic.id}`} className="rounded-[12px] px-3 py-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text">
              {index + 1}. {state(topic.id)?.title ?? topic.id}
            </a>
          ))}
          <a href="#questions" className="rounded-[12px] px-3 py-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text">
            Questions fréquentes
          </a>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {HELP_TOPICS.map((topic, index) => {
            const step = state(topic.id);
            const badge = step ? STEP_STATES[step.state] : null;
            return (
              <Card key={topic.id} id={topic.id} className="scroll-mt-6 p-6 hover:border-border-strong">
                <article aria-labelledby={`${topic.id}-title`} className="flex flex-col gap-4">
                  <header className="flex flex-wrap items-center gap-3">
                    <h2 id={`${topic.id}-title`} className="text-xl font-normal">
                      {index + 1}. {step?.title ?? topic.id}
                    </h2>
                    <span className="rounded-full bg-surface-hover px-2.5 py-0.5 text-[12px] text-text-secondary">
                      {REQUIRED_STEPS.includes(topic.id) ? "Indispensable" : "Facultatif"}
                    </span>
                    {badge && <span className={cn("rounded-full px-2.5 py-0.5 text-[12px]", badge.className)}>{badge.label}</span>}
                  </header>
                  {step && step.state !== "ready" && <p className="text-[13px] text-text-secondary">{step.summary}</p>}
                  <HelpTopicBody topic={topic} />
                  <Button variant="secondary" size="sm" className="self-start" asChild>
                    <Link href={`/reglages#${topic.id}`}>
                      <Settings2 aria-hidden />
                      Configurer
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </article>
              </Card>
            );
          })}

          <Card id="questions" className="scroll-mt-6 p-6 hover:border-border-strong">
            <h2 className="pb-2 text-xl font-normal">Questions fréquentes</h2>
            <div className="flex flex-col divide-y divide-border">
              {HELP_FAQ.map((item) => (
                <details key={item.question} className="group py-3">
                  <summary className="cursor-pointer list-none text-sm font-medium transition-colors duration-150 marker:hidden hover:text-text-secondary">
                    {item.question}
                  </summary>
                  <p className="pt-2 text-sm text-text-secondary">{item.answer}</p>
                </details>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
