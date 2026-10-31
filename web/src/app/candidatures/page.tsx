import type { Metadata } from "next";

import { ApplicationsScreen } from "@/components/applications/applications-screen";

export const metadata: Metadata = { title: "Candidatures" };

export default function ApplicationsPage() {
  return <ApplicationsScreen />;
}
