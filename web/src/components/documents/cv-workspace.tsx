import type { ReactNode } from "react";

/** La disposition en plein écran : les réglages à gauche, le CV en grand à droite. */
export function CvWorkspace({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-full lg:h-full lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-4 border-border p-5 lg:overflow-y-auto lg:border-r">{panel}</div>
      <div className="min-h-0 bg-background-subtle p-4 lg:overflow-y-auto lg:p-8">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
