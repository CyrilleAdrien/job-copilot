"use client";

import { AlertCircle, ArrowUpRight, Check, Copy, Download, KeyRound, Lock, RefreshCw, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ApiError } from "@/lib/api";
import {
  connectCalendar,
  disconnectCalendar,
  discoverCalendars,
  feedDownloadUrl,
  feedUrl,
  fetchCalendarProviders,
  syncCalendar,
  type CalendarAccount,
  type CalendarProvider,
  type RemoteCalendar,
} from "@/lib/calendar";
import { timeAgo } from "@/lib/jobs";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Abonnement .ics (Calendrier sur Mac) et calendrier CalDAV connecté (iCloud ou autre). */
export function CalendarSync({
  account,
  onChange,
}: {
  account: CalendarAccount | null;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Subscription />
      <Card>
        <CardHeader>
          <CardTitle>Calendrier connecté</CardTitle>
          <CardDescription>Chaque événement y est recopié, modifié et supprimé avec l&apos;app.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {account ? <Connected account={account} onChange={onChange} /> : <ConnectForm onConnected={onChange} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Subscription() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(feedUrl(window.location.origin)), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>S&apos;abonner</CardTitle>
        <CardDescription>
          Calendrier sur Mac ou Thunderbird relisent ce flux toutes les heures, sur cet ordinateur.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-[8px] border border-border bg-background-subtle px-2.5 py-2 text-[12px]" title={url}>
            {url}
          </code>
          <Button variant="secondary" size="sm" onClick={copy} aria-label="Copier l'adresse du flux">
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copiée" : "Copier"}
          </Button>
        </div>
        <ol className="flex list-decimal flex-col gap-1 pl-4 text-[12px] text-text-secondary">
          <li>Dans Calendrier, choisis Fichier, puis Nouvel abonnement à un calendrier.</li>
          <li>Colle l&apos;adresse, puis règle l&apos;actualisation sur « Toutes les heures ».</li>
        </ol>
        <Button variant="ghost" size="sm" className="self-start" asChild>
          <a href={feedDownloadUrl} download>
            <Download aria-hidden />
            Télécharger le calendrier (.ics)
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function Connected({ account, onChange }: { account: CalendarAccount; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const report = await syncCalendar();
      setNotice(report.errors.length ? report.errors[0] : `${report.pushed} événement${report.pushed > 1 ? "s" : ""} à jour.`);
      onChange();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    try {
      await disconnectCalendar(account.id);
      onChange();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{account.calendar_name}</span>
          <span className="truncate text-[12px] text-text-tertiary">
            {account.username} · {account.last_sync_at ? `à jour ${timeAgo(account.last_sync_at)}` : "jamais synchronisé"}
          </span>
          {account.last_error && (
            <span className="flex items-start gap-1 text-[12px] text-danger">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {account.last_error}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 hover:text-danger"
          aria-label={`Déconnecter ${account.calendar_name}`}
          title="Déconnecter (les événements déjà recopiés restent)"
          onClick={disconnect}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <Button variant="secondary" size="sm" className="self-start" loading={busy} onClick={sync}>
        <RefreshCw aria-hidden />
        Synchroniser
      </Button>
      {notice && <p className="text-[12px] text-text-secondary" role="status">{notice}</p>}
      {error && <ErrorBanner error={error} />}
    </div>
  );
}

function ConnectForm({ onConnected }: { onConnected: () => void }) {
  const [providers, setProviders] = useState<CalendarProvider[]>([]);
  const [providerId, setProviderId] = useState("icloud");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [calendars, setCalendars] = useState<RemoteCalendar[] | null>(null);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    fetchCalendarProviders()
      .then(setProviders)
      .catch(setError);
  }, []);

  const provider = providers.find((p) => p.id === providerId);
  const custom = providerId === "other";
  const demo = providerId === "demo";
  const credentials = () => ({
    provider: providerId,
    url: custom ? url.trim() : (provider?.url ?? ""),
    username: demo ? "demo" : username.trim(),
    password,
  });

  function pick(id: string) {
    setProviderId(id);
    setCalendars(null);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (calendars === null) {
        const found = await discoverCalendars(credentials());
        setCalendars(found);
        setChosen(found[0]?.url ?? "");
      } else {
        const calendar = calendars.find((c) => c.url === chosen);
        if (!calendar) return;
        await connectCalendar({ ...credentials(), calendar_url: calendar.url, calendar_name: calendar.name });
        onConnected();
      }
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
          label="Calendrier"
          segments={providers.map((p) => ({ value: p.id, label: p.label }))}
          value={providerId}
          onChange={pick}
        />
      )}
      {provider && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-text-secondary">{provider.help}</p>
          {provider.steps.length > 0 && (
            <ol className="flex flex-col gap-2 rounded-[12px] border border-border bg-background-subtle p-3.5" aria-label="Étapes">
              {provider.steps.map((step, index) => (
                <li key={step} className="flex gap-2.5 text-[12px] text-text-secondary">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold tabular-nums text-accent-strong">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}
          {provider.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {provider.links.map((link) => (
                <Button key={link.url} variant="secondary" size="sm" asChild>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                    <ArrowUpRight aria-hidden />
                  </a>
                </Button>
              ))}
              {!provider.caldav && (
                <Button variant="secondary" size="sm" asChild>
                  <a href={feedDownloadUrl} download>
                    <Download aria-hidden />
                    Fichier .ics
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {provider?.caldav && !demo && calendars === null && (
        <div className="flex flex-col gap-3">
          {custom && (
            <Input label="Adresse CalDAV" type="url" required placeholder="https://caldav.exemple.fr" value={url} onChange={(e) => setUrl(e.target.value)} />
          )}
          <Input
            label={providerId === "icloud" ? "Identifiant Apple" : "Identifiant"}
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="Mot de passe d'application"
            type="password"
            required
            autoComplete="off"
            icon={<KeyRound />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="flex gap-2 text-[12px] text-text-tertiary">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Le mot de passe est chiffré sur ta machine. Job Copilot n&apos;écrit que ses propres événements.
          </p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {calendars && (
          <motion.fieldset
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.smooth}
            className="flex flex-col gap-1.5 overflow-hidden"
          >
            <legend className="pb-1.5 text-[13px] font-medium">Où recopier les événements ?</legend>
            {calendars.map((calendar) => (
              <label
                key={calendar.url}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2 text-sm transition-colors",
                  chosen === calendar.url ? "border-accent-strong bg-accent-soft" : "border-border hover:bg-surface-hover",
                )}
              >
                <input
                  type="radio"
                  name="calendar"
                  value={calendar.url}
                  checked={chosen === calendar.url}
                  onChange={() => setChosen(calendar.url)}
                  className="accent-[var(--accent-strong)]"
                />
                {calendar.name}
              </label>
            ))}
          </motion.fieldset>
        )}
      </AnimatePresence>

      {error && <ErrorBanner error={error} />}

      {provider?.caldav && (
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={busy}>
            {calendars === null ? "Chercher mes calendriers" : "Connecter ce calendrier"}
          </Button>
          {calendars !== null && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setCalendars(null)}>
              Retour
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
