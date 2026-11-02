"use client";

import { Cake, Camera, Car, Flag, Mail, MapPin, Phone, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ComponentType, type ReactNode } from "react";

import { linkIcon } from "@/components/profile/brand-icons";
import { ErrorBanner } from "@/components/profile/error-banner";
import { ProfileAvatar, useProfileIdentity } from "@/components/profile/profile-identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, deletePhoto, uploadPhoto } from "@/lib/api";
import { prepareAvatar } from "@/lib/avatar";
import { formatBirthDate, paragraphs, isWebLink, type Profile } from "@/lib/profile";

function Contact({ icon: Icon, children }: { icon: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-text-secondary [&_a]:truncate [&_a]:underline-offset-4 hover:[&_a]:text-text hover:[&_a]:underline">
      <Icon className="size-4 shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden />
      {children}
    </span>
  );
}

/** En-tête du profil : photo, identité et coordonnées. La photo s'affiche ensuite sur tout le site. */
export function ProfilePhotoCard({ profile }: { profile: Profile }) {
  const { identity } = profile;
  const { photoUrl, refresh } = useProfileIdentity();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // L'avatar de la barre du haut suit un import ou une modification faite sur cet écran.
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
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <ProfileAvatar size={112} className="ring-[3px] ring-accent ring-offset-[3px] ring-offset-surface" />
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choisir une photo de profil"
              className="sr-only"
              tabIndex={-1}
              onChange={choose}
            />
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                loading={busy}
                aria-label={photoUrl ? "Changer la photo" : "Ajouter une photo"}
                title={photoUrl ? "Changer la photo" : "Ajouter une photo"}
                onClick={() => input.current?.click()}
              >
                <Camera aria-hidden />
              </Button>
              {photoUrl && (
                <Button variant="ghost" size="icon" className="size-9" disabled={busy} aria-label="Retirer la photo" title="Retirer la photo" onClick={() => run(deletePhoto)}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </div>
          </div>

          <div className="flex min-w-64 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-[28px] font-normal leading-tight">{identity.full_name}</h2>
              <p className="text-base text-text-secondary">{identity.headline}</p>
            </div>
            {identity.availability && (
              <span className="inline-flex w-fit items-center rounded-lg bg-accent px-2.5 py-1 text-[13px] text-[#1f1f1f]">
                Disponibilité : {identity.availability}
              </span>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(identity.address || identity.location) && <Contact icon={MapPin}>{[identity.address, identity.location].filter(Boolean).join(", ")}</Contact>}
              {identity.email && (
                <Contact icon={Mail}>
                  <a href={`mailto:${identity.email}`}>{identity.email}</a>
                </Contact>
              )}
              {identity.phone && (
                <Contact icon={Phone}>
                  <a href={`tel:${identity.phone.replace(/\s/g, "")}`}>{identity.phone}</a>
                </Contact>
              )}
              {identity.links.filter((link) => isWebLink(link.url)).map((link) => (
                <Contact key={link.url} icon={linkIcon(link.url)}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </Contact>
              ))}
              {identity.driving_licence && <Contact icon={Car}>Permis {identity.driving_licence}</Contact>}
              {identity.birth_date && <Contact icon={Cake}>{formatBirthDate(identity.birth_date)}</Contact>}
              {identity.nationality && <Contact icon={Flag}>{identity.nationality}</Contact>}
            </div>
          </div>
        </div>

        {identity.summary && (
          <section className="flex flex-col gap-1.5 rounded-[14px] bg-background-subtle p-4">
            <h3 className="text-sm font-medium">À propos</h3>
            <div className="flex flex-col gap-2 text-sm leading-relaxed text-text-secondary">
              {paragraphs(identity.summary).map((paragraph, index) => (
                <p key={index} className="text-pretty">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        )}
        {error && <ErrorBanner error={error} />}
      </CardContent>
    </Card>
  );
}
