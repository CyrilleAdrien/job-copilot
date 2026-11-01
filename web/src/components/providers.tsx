"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { ProfileIdentityProvider } from "@/components/profile/profile-identity";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <ProfileIdentityProvider>{children}</ProfileIdentityProvider>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
