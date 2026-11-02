import type { ReactNode } from "react";

import { HeroArt } from "@/components/layout/hero-art";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex overflow-hidden rounded-[20px] bg-accent-soft">
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-8 lg:px-11">
        <h1 className="text-4xl font-normal leading-tight">{title}</h1>
        {description && <p className="max-w-2xl text-base text-text-secondary">{description}</p>}
        {actions && <div className="flex flex-wrap items-center gap-3 pt-3">{actions}</div>}
      </div>
      <div className="relative hidden w-[32%] max-w-[420px] shrink-0 lg:block">
        <HeroArt />
      </div>
    </header>
  );
}
