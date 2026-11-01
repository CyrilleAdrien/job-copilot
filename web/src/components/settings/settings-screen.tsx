"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ErrorBanner } from "@/components/profile/error-banner";
import { useProfileIdentity } from "@/components/profile/profile-identity";
import { CalendarSync } from "@/components/calendar/calendar-sync";
import { MailAccounts } from "@/components/mail/mail-accounts";
import { Hint, ModelPanel, ProfilePanel, SourcesPanel, SystemPanel } from "@/components/settings/settings-panels";
import { SettingsStep } from "@/components/settings/settings-step";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, eraseAllData, exportAllData, fetchProfile } from "@/lib/api";
import { fetchCalendarAccounts, type CalendarAccount } from "@/lib/calendar";
import { fetchAccounts, type MailAccount } from "@/lib/mail";
import {
  buildSteps,
  fetchLlm,
  fetchSearchSettings,
  fetchSources,
  fetchSystemStatus,
  firstOpenStep,
  type LlmState,
  type SearchSettings,
  type SourceInfo,
  type StepId,
  type SystemStatus,
} from "@/lib/system";

function download({ blob, filename }: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsScreen() {
  const router = useRouter();
  const { refresh } = useProfileIdentity();
  const [busy, setBusy] = useState<"export" | "erase" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [llm, setLlm] = useState<LlmState | null>(null);
  const [profile, setProfile] = useState<{ name: string; searches: number } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [sources, setSources] = useState<SourceInfo[] | null>(null);
  const [search, setSearch] = useState<SearchSettings | null>(null);
  const [mail, setMail] = useState<MailAccount[] | null>(null);
  const [calendar, setCalendar] = useState<CalendarAccount[] | null>(null);
  const [open, setOpen] = useState<StepId | null>(null);
  const opened = useRef(false);

  // Une panne n'empêche pas de lire le reste : chaque étape dit ce qu'elle sait.
  const load = useCallback(async () => {
    const value = <T,>(result: PromiseSettledResult<T>) => (result.status === "fulfilled" ? result.value : null);
    const [loadedStatus, loadedLlm, loadedProfile, loadedSources, loadedSearch, loadedMail, loadedCalendar] = await Promise.allSettled([
      fetchSystemStatus(),
      fetchLlm(),
      fetchProfile(),
      fetchSources(),
      fetchSearchSettings(),
      fetchAccounts(),
      fetchCalendarAccounts(),
    ]);
    setStatus(value(loadedStatus));
    setLlm(value(loadedLlm));
    const person = value(loadedProfile);
    setProfile(person ? { name: person.identity.full_name, searches: person.searches.length } : null);
    setProfileLoaded(loadedProfile.status === "fulfilled");
    setSources(value(loadedSources));
    setSearch(value(loadedSearch));
    setMail(value(loadedMail));
    setCalendar(value(loadedCalendar));
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const steps = useMemo(
    () => buildSteps({ status, llm, profile, profileLoaded, sources, mail, calendar }),
    [status, llm, profile, profileLoaded, sources, mail, calendar],
  );
  const ready = steps.filter((step) => step.state === "ready").length;
  const required = steps.filter((step) => step.state !== "optional").length;

  // Une seule fois : la suite des rechargements ne doit pas refermer l'étape en cours.
  useEffect(() => {
    if (!loaded || opened.current) return;
    opened.current = true;
    setOpen(firstOpenStep(steps, window.location.hash.slice(1)));
  }, [loaded, steps]);

  async function recheck() {
    setChecking(true);
    await load();
    setChecking(false);
  }

  async function exportData() {
    setBusy("export");
    setError(null);
    try {
      download(await exportAllData());
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(null);
    }
  }

  async function eraseData() {
    setBusy("erase");
    setError(null);
    try {
      await eraseAllData();
      window.localStorage.clear();
      await refresh();
      router.replace("/bienvenue");
    } catch (e) {
      setError(e as ApiError);
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Réglages" description="Tout ce qu'il faut pour que l'application fonctionne, dans l'ordre où chaque étape dépend de la précédente." />
      <div className="flex max-w-3xl flex-col gap-3">
        {error && <ErrorBanner error={error} />}
        {!loaded ? (
          <div className="flex flex-col gap-3" aria-busy aria-label="Chargement des réglages">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="h-[72px] rounded-card" />
            ))}
          </div>
        ) : (
          <>
            <p role="status" className="text-[13px] text-text-secondary">
              {ready} étape{ready > 1 ? "s" : ""} prête{ready > 1 ? "s" : ""} sur {required}.
            </p>
            {steps.map((step, index) => (
              <SettingsStep key={step.id} step={step} number={index + 1} open={open === step.id} onToggle={() => setOpen(open === step.id ? null : step.id)}>
                {step.id === "systeme" && <SystemPanel status={status} encryption={search?.encryption ?? null} busy={checking} onRefresh={recheck} />}
                {step.id === "modele" && <ModelPanel llm={llm} onChange={setLlm} />}
                {step.id === "profil" && <ProfilePanel profile={profile} />}
                {step.id === "sources" && (sources ? <SourcesPanel sources={sources} search={search} onChange={load} onSearchChange={setSearch} /> : <Hint>Le service des offres ne répond pas.</Hint>)}
                {step.id === "boite-mail" && (mail ? <MailAccounts accounts={mail} onChange={load} onError={(e) => setError(e as ApiError)} /> : <Hint>Le service mail ne répond pas.</Hint>)}
                {step.id === "calendrier" && (calendar ? <div className="flex flex-col gap-5"><CalendarSync account={calendar[0] ?? null} onChange={load} /></div> : <Hint>Le service calendrier ne répond pas.</Hint>)}
                {step.id === "donnees" && (
                  <div className="flex flex-col gap-5">
                    <section className="flex items-center justify-between gap-6">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-medium">Exporter mes données</h3>
                        <p className="text-[13px] text-text-secondary">
                          Une archive .zip avec le profil, les offres, les candidatures, les mails, le calendrier, les CV et les lettres. Les mots de passe et les clés n&apos;en font pas partie.
                        </p>
                      </div>
                      <Button variant="secondary" className="shrink-0" loading={busy === "export"} onClick={exportData}>
                        <Download aria-hidden />
                        Exporter
                      </Button>
                    </section>
                    <div className="border-t border-border" />
                    <section className="flex items-center justify-between gap-6">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-medium">Supprimer mes données</h3>
                        <p className="text-[13px] text-text-secondary">Efface définitivement tout ce que job-copilot conserve sur cet ordinateur.</p>
                      </div>
                      <Button variant="danger" className="shrink-0" onClick={() => setConfirming(true)}>
                        <Trash2 aria-hidden />
                        Tout supprimer
                      </Button>
                    </section>
                  </div>
                )}
              </SettingsStep>
            ))}
          </>
        )}
      </div>

      <Modal
        open={confirming}
        onClose={() => busy === null && setConfirming(false)}
        title="Tout supprimer ?"
        description="Cette action est définitive. Pense à exporter tes données avant si tu veux les garder."
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 text-[13px] text-text-secondary sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-text">Sera effacé ici</span>
              <span>
                Profil et photo, offres et favoris, CV et lettres, candidatures, mails lus et réponses, événements, les
                connexions aux comptes et les clés des sources.
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-text">Ne sera pas touché</span>
              <span>Ta vraie boîte mail, ton calendrier en ligne et les mails déjà envoyés.</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy !== null} onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button variant="danger" loading={busy === "erase"} onClick={eraseData}>
              Tout supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
