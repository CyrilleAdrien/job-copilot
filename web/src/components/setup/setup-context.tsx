"use client";

import { Lock as LockIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isDemo, loadSetup, lockFor, needsAssistant, type Lock, type SetupData } from "@/lib/setup";

type Setup = {
  data: SetupData | null;
  refresh: () => Promise<void>;
};

const Context = createContext<Setup>({ data: null, refresh: async () => undefined });

export const useSetup = () => useContext(Context);

/** Relu au plus toutes les 10 s en changeant d'écran ; tout de suite après un réglage (refresh). */
const STALE_MS = 10_000;

export function SetupProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [data, setData] = useState<SetupData | null>(null);
  const loadedAt = useRef(0);

  const refresh = useCallback(async () => {
    loadedAt.current = Date.now();
    setData(await loadSetup());
  }, []);

  useEffect(() => {
    if (Date.now() - loadedAt.current > STALE_MS) refresh();
  }, [refresh, pathname]);

  const value = useMemo(() => ({ data, refresh }), [data, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Écrans toujours ouverts : ceux qui servent à configurer, et l'aide. */
const OPEN = ["/configuration", "/bienvenue", "/aide", "/reglages", "/profil", "/design"];
const isOpen = (pathname: string) => OPEN.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export function useLock(pathname: string): Lock | null {
  const { data } = useSetup();
  return data && !isOpen(pathname) ? lockFor(pathname, data) : null;
}

/** Envoie vers l'assistant au premier lancement, et remplace un écran verrouillé par ce qui manque. */
export function SetupGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSetup();
  const lock = useLock(pathname);
  const redirect = data !== null && !isOpen(pathname) && needsAssistant(data);

  useEffect(() => {
    if (redirect) router.replace("/configuration");
  }, [redirect, router]);

  if (redirect) return null;
  if (lock) return <LockedScreen lock={lock} />;
  return <>{children}</>;
}

function LockedScreen({ lock }: { lock: Lock }) {
  return (
    <div className="pt-8">
      <EmptyState
        icon={LockIcon}
        title="Cet écran n'est pas encore disponible"
        description={lock.reason}
        action={
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button size="sm" asChild>
              <Link href={`/reglages#${lock.step}`}>Configurer</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/aide#${lock.step}`}>Voir l&apos;aide</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}

export const useDemo = () => isDemo(useSetup().data?.mode ?? null);
