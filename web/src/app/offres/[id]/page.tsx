import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OfferDetailScreen } from "@/components/jobs/offer-detail-screen";

export const metadata: Metadata = { title: "Offre" };

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offerId = Number(id);
  if (!Number.isInteger(offerId) || offerId <= 0) notFound();
  return <OfferDetailScreen offerId={offerId} />;
}
