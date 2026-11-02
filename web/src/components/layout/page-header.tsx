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
    <header className="hero mb-8 flex items-center gap-6 overflow-hidden rounded-[20px] bg-accent-soft">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-7 pl-8 lg:pl-11">
        <h1 className="text-4xl font-normal leading-tight">{title}</h1>
        {description && <p className="max-w-2xl text-base text-text-secondary">{description}</p>}
        {actions && <div className="flex flex-wrap items-center gap-3 pt-3">{actions}</div>}
      </div>
      <div className="hidden h-36 w-[340px] shrink-0 self-end pr-6 lg:block">
        <HeroArt />
      </div>
    </header>
  );
}
