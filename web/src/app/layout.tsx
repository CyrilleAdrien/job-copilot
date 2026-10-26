import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "job-copilot", template: "%s · job-copilot" },
  description: "Assistant de candidature open source, installé en local.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="flex min-h-dvh">
            <Sidebar />
            <main className="min-w-0 flex-1 px-10 py-10">
              <div className="mx-auto max-w-5xl">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
