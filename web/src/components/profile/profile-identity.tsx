"use client";

import { UserRound } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchPhotoUrl, fetchProfile } from "@/lib/api";
import { initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type ProfileIdentity = {
  name: string | null;
  photoUrl: string | null;
  refresh: () => Promise<void>;
};

const Context = createContext<ProfileIdentity>({ name: null, photoUrl: null, refresh: async () => undefined });

export const useProfileIdentity = () => useContext(Context);

/** Le nom et la photo, pour tout le site. Facultatifs : sans eux, l'app reste utilisable. */
export function ProfileIdentityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [name, setName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [profile, url] = await Promise.allSettled([fetchProfile(), fetchPhotoUrl()]);
    if (profile.status === "fulfilled") setName(profile.value?.identity.full_name ?? null);
    if (url.status === "fulfilled") setPhotoUrl(url.value);
  }, []);

  // Relu à chaque écran : l'assistant de profil enregistre le nom puis change de page.
  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  const value = useMemo(() => ({ name, photoUrl, refresh }), [name, photoUrl, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** La photo de profil ; à défaut, les initiales ou une icône. */
export function ProfileAvatar({ size, className }: { size: number; className?: string }) {
  const { name, photoUrl } = useProfileIdentity();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const letters = initials(name);
  const shape = cn("shrink-0 rounded-full", className);

  if (photoUrl && failedUrl !== photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt="Photo de profil"
        width={size}
        height={size}
        unoptimized
        className={cn(shape, "object-cover")}
        style={{ width: size, height: size }}
        onError={() => setFailedUrl(photoUrl)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(shape, "flex items-center justify-center bg-accent-soft font-medium text-accent-strong")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {letters || <UserRound style={{ width: size * 0.55, height: size * 0.55 }} />}
    </span>
  );
}
