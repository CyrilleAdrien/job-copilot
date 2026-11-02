import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
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
            <main className="min-w-0 flex-1 px-6 pb-12 lg:px-12">
              <Suspense>
                <TopBar />
                <div className="w-full">{children}</div>
              </Suspense>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
