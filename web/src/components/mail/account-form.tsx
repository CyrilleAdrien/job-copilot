"use client";

import { ArrowUpRight, CircleHelp, KeyRound, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ApiError } from "@/lib/api";
import { addAccount, fetchProviders, type MailAccount, type Provider } from "@/lib/mail";
import { spring } from "@/lib/motion";

/** Connexion d'une boîte en IMAP, avec un mot de passe d'application (chiffré côté serveur). */
export function AccountForm({ onAdded, onCancel }: { onAdded: (account: MailAccount) => void; onCancel?: () => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("993");
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .catch(setError);
  }, []);

  const provider = providers.find((p) => p.id === providerId);
  const custom = providerId === "other";
  const demo = providerId === "demo";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!provider) return;
    setBusy(true);
    setError(null);
    try {
      onAdded(
        await addAccount({
          email: email.trim() || (demo ? "demo@job-copilot.local" : ""),
          host: custom ? host.trim() : provider.host,
          port: custom ? Number(port) || 993 : provider.port,
          password,
        }),
      );
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {providers.length > 0 && (
        <SegmentedControl
          label="Fournisseur"
          segments={providers.map((p) => ({ value: p.id, label: p.label }))}
          value={providerId}
          onChange={setProviderId}
        />
      )}
      {provider && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <p className="flex-1 text-[13px] text-text-secondary">{provider.help}</p>
            {provider.steps.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={helpOpen}
                aria-controls="app-password-help"
                onClick={() => setHelpOpen((open) => !open)}
              >
                <CircleHelp aria-hidden />
                {helpOpen ? "Masquer l'aide" : "Aide"}
              </Button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {helpOpen && provider.steps.length > 0 && (
              <motion.div
                key={provider.id}
                id="app-password-help"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.smooth}
                className="overflow-hidden"
              >
                <section
                  aria-label={`Créer un mot de passe d'application ${provider.label}`}
                  className="flex flex-col gap-3 rounded-[12px] border border-border bg-background-subtle p-4"
                >
                  <h3 className="text-[13px] font-semibold">Créer un mot de passe d&apos;application {provider.label}</h3>
                  <ol className="flex flex-col gap-2">
                    {provider.steps.map((step, index) => (
                      <li key={step} className="flex gap-2.5 text-[13px] text-text-secondary">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold tabular-nums text-accent-strong">
                          {index + 1}
                        </span>
                        <span className="pt-px">{step}</span>
                      </li>
                    ))}
                  </ol>
                  {provider.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {provider.links.map((link) => (
                        <Button key={link.url} variant="secondary" size="sm" asChild>
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            {link.label}
                            <ArrowUpRight aria-hidden />
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!demo && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Adresse mail"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Mot de passe d'application"
            type="password"
            required
            autoComplete="off"
            icon={<KeyRound />}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="Pas ton mot de passe habituel."
          />
          {custom && (
            <>
              <Input label="Serveur IMAP" required placeholder="imap.exemple.fr" value={host} onChange={(e) => setHost(e.target.value)} />
              <Input label="Port" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value)} />
            </>
          )}
        </div>
      )}

      <p className="flex gap-2 text-[12px] text-text-tertiary">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Ta boîte est lue sans rien y modifier, et un mail ne part que si tu cliques sur Envoyer. Le mot de passe est chiffré sur
        ta machine. Seuls les mails liés à tes candidatures ou au recrutement sont gardés et analysés.
      </p>

      {error && <ErrorBanner error={error} />}

      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!provider}>
          Connecter la boîte
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
