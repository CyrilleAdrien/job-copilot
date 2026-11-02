import type { Metadata } from "next";

import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

export const metadata: Metadata = { title: { absolute: "Tableau de bord · job-copilot" } };

export default function HomePage() {
  return <DashboardScreen />;
}
