"use client";

import { ArrowUpRight, Check, CircleCheck, CircleX, KeyRound, Play, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiError } from "@/lib/api";
import {
  chooseModel,
  dependencyStates,
  removeSourceKeys,
  saveSearchSettings,
  saveSourceKeys,
  serviceWorks,
  testLlm,
  testSource,
  type LlmState,
  type SearchSettings,
  type SourceInfo,
  type SystemStatus,
} from "@/lib/system";

function Line({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <li className="flex items-center gap-2 text-[13px]">
      <Icon className={ok ? "size-4 shrink-0 text-success" : "size-4 shrink-0 text-danger"} aria-hidden />
      <span>{label}</span>
      <span className="sr-only">{ok ? "fonctionne" : "en panne"}</span>
      {detail && <span className="truncate text-text-tertiary">{detail}</span>}
    </li>
  );
}

const SERVICE_LABELS: Record<string, string> = {
  profile: "Profil",
  jobs: "Offres",
  documents: "CV et lettres",
  applications: "Candidatures",
  mail: "Mail",
  calendar: "Calendrier",
};
const DEPENDENCY_LABELS: Record<string, string> = { postgres: "Base de données", redis: "Redis", s3: "Stockage des fichiers" };

export function SystemPanel({
  status,
  encryption,
  busy,
  onRefresh,
}: {
  status: SystemStatus | null;
  encryption: boolean | null;
  busy: boolean;
  onRefresh: () => void;
}) {
  const dependencies = status ? dependencyStates(status) : {};
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-text-secondary">Services</h3>
          <ul className="flex flex-col gap-1.5">
            {Object.entries(SERVICE_LABELS).map(([name, label]) => (
              <Line key={name} label={label} ok={serviceWorks(status?.services[name])} />
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-text-secondary">Fondations</h3>
          <ul className="flex flex-col gap-1.5">
            {Object.entries(DEPENDENCY_LABELS).map(([name, label]) => (
              <Line key={name} label={label} ok={dependencies[name] === true} />
            ))}
            <Line label="Clé de chiffrement" ok={encryption === true} />
          </ul>
        </div>
      </div>
      <p className="text-[13px] text-text-secondary">
        La clé de chiffrement, la base de données et les ports restent dans le fichier <code>.env</code>. Change-les là, puis lance <code>make up</code>.
      </p>
      <Button variant="secondary" size="sm" className="self-start" loading={busy} onClick={onRefresh}>
        <RefreshCw aria-hidden />
        Vérifier de nouveau
      </Button>
    </div>
  );
}

export function ModelPanel({ llm, onChange }: { llm: LlmState | null; onChange: (llm: LlmState) => void }) {
  const [busy, setBusy] = useState<"test" | "choose" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function run(kind: "test" | "choose", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      await action();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(null);
    }
  }

  if (llm === null) return <p className="text-[13px] text-text-secondary">La passerelle ne répond pas : relance la stack avec <code>make up</code>.</p>;
  if (llm.provider === "demo") return <p className="text-[13px] text-text-secondary">LLM_PROVIDER=demo : les textes viennent de modèles fixes. Pour utiliser Ollama, change cette ligne dans <code>.env</code> puis lance <code>make up</code>.</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-secondary">
        Le modèle tourne sur ton ordinateur, à l&apos;adresse <code>{llm.url}</code>. Il rédige les CV, les lettres et les réponses, et classe les mails.
      </p>
      {!llm.reachable ? (
        <p className="text-[13px] text-danger">Ollama ne répond pas. Lance-le, puis vérifie de nouveau.</p>
      ) : llm.installed.length === 0 ? (
        <p className="text-[13px] text-danger">Aucun modèle installé : lance <code>make models</code>.</p>
      ) : (
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Modèle utilisé
          <select
            value={llm.model}
            disabled={busy !== null}
            onChange={(event) => run("choose", async () => onChange(await chooseModel(event.target.value)))}
            className="h-10 max-w-sm rounded-[10px] border border-border bg-surface px-3 text-sm font-normal"
          >
            {!llm.model_installed && <option value={llm.model}>{llm.model} (absent)</option>}
            {llm.installed.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          className="text-ai-strong"
          loading={busy === "test"}
          disabled={!llm.model_installed || busy !== null}
          onClick={() =>
            run("test", async () => {
              const test = await testLlm();
              setResult(`${test.model} a répondu en ${test.seconds.toFixed(1)} s.`);
            })
          }
        >
          <Play aria-hidden />
          Tester le modèle
        </Button>
        {result && (
          <span role="status" className="flex items-center gap-1 text-[13px] text-success">
            <Check className="size-4" aria-hidden />
            {result}
          </span>
        )}
      </div>
      {error && <ErrorBanner error={error} />}
    </div>
  );
}

export function ProfilePanel({ profile }: { profile: { name: string; searches: number } | null }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-[13px] text-text-secondary">
        {profile ? "Ton identité, ton parcours et tes critères de recherche servent aux offres, aux CV et aux lettres." : "Ton profil donne les critères de recherche et le contenu des CV. Les étapes suivantes en dépendent."}
      </p>
      <Button variant="secondary" size="sm" asChild>
        <Link href={profile ? "/profil" : "/bienvenue"}>
          {profile ? "Modifier mon profil" : "Remplir mon profil"}
          <ArrowUpRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

const SOURCE_FORMS: Record<string, { idLabel: string; secretLabel: string; help: string; url: string }> = {
  france_travail: { idLabel: "Identifiant client", secretLabel: "Clé secrète", help: "Crée une application avec l'API « Offres d'emploi v2 ».", url: "https://francetravail.io" },
  adzuna: { idLabel: "Application ID", secretLabel: "Application key", help: "Crée un compte développeur gratuit.", url: "https://developer.adzuna.com" },
};
const DELAYS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 heure" },
  { minutes: 360, label: "6 heures" },
  { minutes: 1440, label: "1 jour" },
];

function SourceRow({ source, onChange }: { source: SourceInfo; onChange: () => void }) {
  const form = SOURCE_FORMS[source.name];
  const [editing, setEditing] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function run(kind: string, action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      await action();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    run("save", async () => {
      await saveSourceKeys(source.name, { key_id: keyId.trim(), secret: secret.trim() });
      setEditing(false);
      setKeyId("");
      setSecret("");
      setResult("Clés acceptées par la source et enregistrées, chiffrées.");
      onChange();
    });
  }

  // La source de démonstration n'a pas de clé à régler.
  if (!form) return <li className="py-3 text-sm first:pt-0">{source.label}<span className="text-text-tertiary"> : offres fictives activées dans .env.</span></li>;

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">{source.label}</span>
          <span className="text-[12px] text-text-tertiary">
            {source.origin === "settings" ? "Clés enregistrées ici, chiffrées." : source.origin === "env" ? "Clés lues dans .env." : "Pas de clé."}
          </span>
        </div>
        {source.configured && (
          <Button variant="ghost" size="sm" loading={busy === "test"} onClick={() => run("test", async () => {
            await testSource(source.name);
            setResult("Clés acceptées par la source.");
          })}>
            Tester
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
          <KeyRound aria-hidden />
          {source.configured ? "Remplacer" : "Ajouter les clés"}
        </Button>
        {source.origin === "settings" && (
          <Button variant="ghost" size="icon" className="size-8 hover:text-danger" aria-label={`Retirer les clés de ${source.label}`} title="Retirer les clés" loading={busy === "remove"} onClick={() => run("remove", async () => {
            await removeSourceKeys(source.name);
            onChange();
          })}>
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>
      {result && <p role="status" className="flex items-center gap-1 text-[13px] text-success"><Check className="size-4" aria-hidden />{result}</p>}
      {error && <ErrorBanner error={error} />}
      {editing && (
        <form onSubmit={submit} aria-label={`Clés ${source.label}`} className="flex flex-col gap-3 rounded-[12px] border border-border bg-background-subtle p-3.5">
          <p className="text-[13px] text-text-secondary">
            {form.help}{" "}
            <a href={form.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-accent-strong hover:underline">
              {form.url.replace("https://", "")}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          </p>
          <Input label={form.idLabel} value={keyId} autoComplete="off" onChange={(event) => setKeyId(event.target.value)} />
          <Input label={form.secretLabel} type="password" value={secret} autoComplete="off" onChange={(event) => setSecret(event.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
            <Button type="submit" size="sm" loading={busy === "save"} disabled={!keyId.trim() || !secret.trim()}>Tester et enregistrer</Button>
          </div>
        </form>
      )}
    </li>
  );
}

export function SourcesPanel({
  sources,
  search,
  onChange,
  onSearchChange,
}: {
  sources: SourceInfo[];
  search: SearchSettings | null;
  onChange: () => void;
  onSearchChange: (search: SearchSettings) => void;
}) {
  const [error, setError] = useState<ApiError | null>(null);
  const known = search && DELAYS.some((delay) => delay.minutes === search.refresh_minutes);

  async function choose(minutes: number) {
    setError(null);
    try {
      onSearchChange(await saveSearchSettings(minutes));
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border">
        {sources.map((source) => (
          <SourceRow key={source.name} source={source} onChange={onChange} />
        ))}
      </ul>
      {search && (
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Délai minimum entre deux recherches
          <select
            value={search.refresh_minutes}
            onChange={(event) => choose(Number(event.target.value))}
            className="h-10 max-w-xs rounded-[10px] border border-border bg-surface px-3 text-sm font-normal"
          >
            {!known && <option value={search.refresh_minutes}>{search.refresh_minutes} minutes</option>}
            {DELAYS.map((delay) => (
              <option key={delay.minutes} value={delay.minutes}>
                {delay.label}
              </option>
            ))}
          </select>
          <span className="font-normal text-text-secondary">La recherche part quand tu ouvres les offres. Le bouton Actualiser ignore ce délai.</span>
        </label>
      )}
      {error && <ErrorBanner error={error} />}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-text-secondary">{children}</p>;
}
