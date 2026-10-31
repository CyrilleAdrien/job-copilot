/** Profil de recherche choisi sur l'écran Offres, retenu dans le navigateur. */

const KEY = "jobcopilot.search";

export function storedSearch(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeSearch(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Navigation privée ou stockage bloqué : le choix ne sera simplement pas retenu.
  }
}

/** L'identifiant retenu s'il existe encore, sinon le premier profil de recherche. */
export function pickSearch(ids: string[], stored: string | null): string | undefined {
  return stored && ids.includes(stored) ? stored : ids[0];
}
