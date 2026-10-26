import type { Metadata } from "next";

import { ProfileWizard } from "@/components/profile/wizard";

export const metadata: Metadata = { title: "Configurer mon profil" };

export default function OnboardingPage() {
  return <ProfileWizard />;
}
