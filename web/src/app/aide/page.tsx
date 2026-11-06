import type { Metadata } from "next";

import { HelpScreen } from "@/components/setup/help-screen";

export const metadata: Metadata = { title: "Aide" };

export default function HelpPage() {
  return <HelpScreen />;
}
