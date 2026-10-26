import {
  CalendarCheck,
  CircleDashed,
  CircleSlash,
  Medal,
  Repeat,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type ApplicationStatus =
  | "draft"
  | "sent"
  | "followed_up"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type Tone = "neutral" | "accent" | "ai" | "success" | "warning" | "danger";

export const applicationStatuses: Record<
  ApplicationStatus,
  { label: string; tone: Tone; icon: LucideIcon }
> = {
  draft: { label: "À envoyer", tone: "neutral", icon: CircleDashed },
  sent: { label: "Envoyée", tone: "accent", icon: Send },
  followed_up: { label: "Relancée", tone: "warning", icon: Repeat },
  interview: { label: "Entretien", tone: "ai", icon: CalendarCheck },
  offer: { label: "Offre", tone: "success", icon: Medal },
  rejected: { label: "Refus", tone: "danger", icon: XCircle },
  withdrawn: { label: "Abandonnée", tone: "neutral", icon: CircleSlash },
};
