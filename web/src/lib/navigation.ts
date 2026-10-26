import {
  BriefcaseBusiness,
  CalendarDays,
  FileStack,
  Inbox,
  LayoutDashboard,
  Palette,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Étape du projet qui livre l'écran ; absent quand il existe déjà. */
  step?: number;
};

export const mainNav: NavItem[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, step: 7 },
  { href: "/offres", label: "Offres", icon: BriefcaseBusiness },
  { href: "/candidatures", label: "Candidatures", icon: FileStack, step: 6 },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDays, step: 9 },
  { href: "/boite-de-reception", label: "Boîte de réception", icon: Inbox, step: 8 },
];

export const secondaryNav: NavItem[] = [
  { href: "/profil", label: "Profil", icon: UserRound },
  { href: "/design", label: "Design system", icon: Palette },
  { href: "/reglages", label: "Réglages", icon: Settings, step: 10 },
];

export const allNav = [...mainNav, ...secondaryNav];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
