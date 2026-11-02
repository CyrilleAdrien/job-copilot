import type { Metadata } from "next";

import { OffersScreen } from "@/components/jobs/offers-screen";

export const metadata: Metadata = { title: "Offres" };

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim() ?? "";
  // Une autre recherche repart d'un écran neuf.
  return <OffersScreen key={query} query={query} />;
}
