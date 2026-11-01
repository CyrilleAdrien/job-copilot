"use client";

import { Camera, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { ErrorBanner } from "@/components/profile/error-banner";
import { ProfileAvatar, useProfileIdentity } from "@/components/profile/profile-identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, deletePhoto, uploadPhoto } from "@/lib/api";
import { prepareAvatar } from "@/lib/avatar";
import type { Profile } from "@/lib/profile";

/** La photo de profil, affichée ensuite sur tout le site. */
export function ProfilePhotoCard({ profile }: { profile: Profile }) {
  const { photoUrl, refresh } = useProfileIdentity();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Le nom de la barre latérale suit un import ou une modification faite sur cet écran.
  useEffect(() => {
    refresh();
  }, [profile, refresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Remis à zéro : choisir de nouveau le même fichier doit fonctionner.
    event.target.value = "";
    if (file) run(async () => uploadPhoto(await prepareAvatar(file)));
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <ProfileAvatar size={72} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="truncate text-[15px] font-semibold tracking-tight">{profile.identity.full_name}</h2>
            <p className="text-[13px] text-text-secondary">Ta photo s&apos;affiche sur tout le site. Elle ne figure ni sur tes CV ni dans l&apos;export du profil.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choisir une photo de profil"
              className="sr-only"
              tabIndex={-1}
              onChange={choose}
            />
            <Button variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
              <Camera aria-hidden />
              {photoUrl ? "Changer la photo" : "Ajouter une photo"}
            </Button>
            {photoUrl && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(deletePhoto)}>
                <Trash2 aria-hidden />
                Retirer
              </Button>
            )}
          </div>
        </div>
        {error && <ErrorBanner error={error} />}
      </CardContent>
    </Card>
  );
}
