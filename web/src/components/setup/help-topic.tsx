"use client";

import { ArrowUpRight, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";

import { MailPrivacy } from "@/components/mail/mail-privacy";
import { fetchCalendarProviders } from "@/lib/calendar";
import type { HelpLink, HelpTopic } from "@/lib/help";
import { fetchProviders } from "@/lib/mail";

type ProviderGuide = { id: string; label: string; steps: string[]; links: HelpLink[] };

function ExternalLink({ link }: { link: HelpLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 rounded-full border border-border px-3 py-1 text-[13px] transition-colors duration-150 hover:border-text"
    >
      {link.label}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </a>
  );
}

/** Le pas à pas de chaque fournisseur, tel que le service mail ou calendrier le connaît. */
function ProviderGuides({ kind }: { kind: "mail" | "calendar" }) {
  const [guides, setGuides] = useState<ProviderGuide[] | null>(null);

  useEffect(() => {
    const load = kind === "mail" ? fetchProviders : fetchCalendarProviders;
    load()
      .then((providers) => setGuides(providers.filter((provider) => provider.steps.length > 0)))
      .catch(() => setGuides([]));
  }, [kind]);

  if (!guides?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-[13px] font-medium text-text-secondary">Selon ton fournisseur</h4>
      <div className="grid gap-2 md:grid-cols-2">
        {guides.map((guide) => (
          <details key={guide.id} className="group rounded-[12px] border border-border bg-surface transition-colors duration-150 hover:border-border-strong open:border-border-strong">
            <summary className="cursor-pointer list-none px-3.5 py-2.5 text-sm font-medium marker:hidden">{guide.label}</summary>
            <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
              <ol className="flex list-decimal flex-col gap-1 pl-4 text-[13px] text-text-secondary">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {guide.links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {guide.links.map((link) => (
                    <ExternalLink key={link.url} link={link} />
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** À quoi sert l'étape, puis quoi faire, dans l'ordre. */
export function HelpTopicBody({ topic }: { topic: HelpTopic }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">{topic.why}</p>
      <ol className="flex flex-col gap-2.5">
        {topic.how.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-medium">
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      {topic.providers === "mail" && <MailPrivacy />}
      {topic.providers && <ProviderGuides kind={topic.providers} />}
      {topic.links && (
        <div className="flex flex-wrap gap-2">
          {topic.links.map((link) => (
            <ExternalLink key={link.url} link={link} />
          ))}
        </div>
      )}
      {topic.tip && (
        <p className="flex gap-2 text-[13px] text-text-secondary">
          <Lightbulb className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {topic.tip}
        </p>
      )}
    </div>
  );
}
