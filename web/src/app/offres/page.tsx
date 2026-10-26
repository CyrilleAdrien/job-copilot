import type { Metadata } from "next";

import { OffersScreen } from "@/components/jobs/offers-screen";

export const metadata: Metadata = { title: "Offres" };

export default function OffersPage() {
  return <OffersScreen />;
}
