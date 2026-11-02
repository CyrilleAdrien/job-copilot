export type HeroScene = "dashboard" | "offers" | "applications" | "calendar" | "inbox" | "profile" | "settings" | "send";

const SCENES: [string, HeroScene][] = [
  ["/offres", "offers"],
  ["/candidatures", "applications"],
  ["/calendrier", "calendar"],
  ["/boite-de-reception", "inbox"],
  ["/profil", "profile"],
  ["/bienvenue", "profile"],
  ["/reglages", "settings"],
];

/** L'illustration du bandeau : une étape du parcours de candidature, selon la page. */
export function heroScene(pathname: string): HeroScene {
  if (pathname === "/") return "dashboard";
  return SCENES.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "send";
}
