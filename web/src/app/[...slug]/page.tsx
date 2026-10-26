import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/coming-soon";
import { allNav } from "@/lib/navigation";

export default async function PlannedScreen({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const item = allNav.find((entry) => entry.href === `/${slug.join("/")}` && entry.step);
  if (!item) notFound();
  return <ComingSoon item={item} />;
}
