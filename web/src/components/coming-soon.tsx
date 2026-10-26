import { Hammer } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import type { NavItem } from "@/lib/navigation";

export function ComingSoon({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.label} />
      <EmptyState
        icon={Hammer}
        title="Cet écran arrive bientôt"
        description={`Il sera livré à l'étape ${item.step} du projet.`}
      />
    </>
  );
}
