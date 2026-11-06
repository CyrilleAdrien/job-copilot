"use client";

import { FlaskConical, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { useProfileIdentity } from "@/components/profile/profile-identity";
import { useSetup } from "@/components/setup/setup-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ApiError, eraseAllData } from "@/lib/api";

/** En démonstration : le rappeler partout, et permettre d'en sortir pour configurer l'outil pour de vrai. */
export function DemoBadge() {
  const router = useRouter();
  const { data, refresh } = useSetup();
  const identity = useProfileIdentity();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  if (data?.mode?.mode !== "demo" || data.mode.forced_demo) return null;

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      await eraseAllData();
      window.localStorage.clear();
      await Promise.all([refresh(), identity.refresh()]);
      setConfirming(false);
      router.replace("/configuration");
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="group flex h-9 items-center gap-2 rounded-full border border-border bg-accent-soft px-3.5 text-[13px] transition-colors duration-150 hover:border-text"
      >
        <FlaskConical className="size-4" strokeWidth={1.75} aria-hidden />
        Démonstration
        <span className="text-text-secondary transition-colors group-hover:text-text">· Quitter</span>
      </button>
      <Modal
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        title="Quitter la démonstration ?"
        description="Les offres, candidatures, mails et entretiens fictifs sont effacés. L'assistant te guide ensuite pour configurer l'outil avec tes propres comptes."
      >
        <div className="flex flex-col gap-4">
          {error && <ErrorBanner error={error} />}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Rester en démo
            </Button>
            <Button loading={busy} onClick={leave}>
              <LogOut aria-hidden />
              Quitter et configurer
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
