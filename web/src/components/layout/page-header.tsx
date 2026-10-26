import type { ReactNode } from "react";

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
    <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="text-[15px] text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
