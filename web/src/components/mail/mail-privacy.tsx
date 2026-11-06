"use client";

import { ShieldCheck } from "lucide-react";
import { useId } from "react";

/** Avant de connecter une boîte : ce que l'outil lira, où c'est traité, et le conseil d'une adresse dédiée. */
export function MailPrivacy() {
  const title = useId();
  return (
    <section aria-labelledby={title} className="flex gap-3 rounded-[12px] border border-border bg-background-subtle p-3.5">
      <ShieldCheck className="mt-0.5 size-5 shrink-0" strokeWidth={1.5} aria-hidden />
      <div className="flex flex-col gap-1.5 text-[13px] text-text-secondary">
        <h3 id={title} className="text-sm font-medium text-text">
          L&apos;application aura accès à cette boîte
        </h3>
        <p>
          job-copilot lit les mails reçus pour retrouver les réponses à tes candidatures. Ils sont analysés sur ton ordinateur, par
          ton IA locale : rien n&apos;est envoyé à un service extérieur.
        </p>
        <p>
          <span className="font-medium text-text">Conseil RGPD :</span> utilise une adresse dédiée à tes candidatures, si ce
          n&apos;est pas déjà le cas. Ta boîte personnelle contient aussi les données de tes proches et de tes contacts ; une
          adresse dédiée limite ce que l&apos;outil peut lire, et se supprime facilement une fois ta recherche terminée.
        </p>
      </div>
    </section>
  );
}
