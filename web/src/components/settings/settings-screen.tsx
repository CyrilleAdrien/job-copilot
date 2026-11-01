"use client";

import { CalendarDays, ChevronRight, Download, Inbox, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ErrorBanner } from "@/components/profile/error-banner";
import { useProfileIdentity } from "@/components/profile/profile-identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ApiError, eraseAllData, exportAllData } from "@/lib/api";

const accounts: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    href: "/boite-de-reception",
    label: "Boîtes mail",
    description: "Connexion et lecture, depuis la boîte de réception.",
    icon: Inbox,
  },
  {
    href: "/calendrier",
    label: "Calendrier",
    description: "Synchronisation et abonnement .ics, depuis le calendrier.",
    icon: CalendarDays,
  },
];

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
      <PageHeader title="Réglages" description="Tes comptes connectés et tes données." />
      <div className="flex max-w-2xl flex-col gap-4">
        {error && <ErrorBanner error={error} />}

        <Card>
          <CardContent className="flex flex-col gap-1 p-2">
            {accounts.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors duration-150 hover:bg-surface-hover"
              >
                <Icon className="size-[18px] shrink-0 text-text-secondary" strokeWidth={1.75} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-[13px] text-text-secondary">{description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-tertiary" aria-hidden />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-5 p-5">
            <section className="flex items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-medium">Exporter mes données</h2>
                <p className="text-[13px] text-text-secondary">
                  Une archive .zip avec le profil, les offres, les candidatures, les mails, le calendrier, les CV et
                  les lettres. Les mots de passe n&apos;en font pas partie.
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
                <h2 className="text-sm font-medium">Supprimer mes données</h2>
                <p className="text-[13px] text-text-secondary">
                  Efface définitivement tout ce que job-copilot conserve sur cet ordinateur.
                </p>
              </div>
              <Button variant="danger" className="shrink-0" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
                Tout supprimer
              </Button>
            </section>
          </CardContent>
        </Card>
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
                Profil et photo, offres et favoris, CV et lettres, candidatures, mails lus et réponses, événements, et
                les connexions aux comptes.
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
