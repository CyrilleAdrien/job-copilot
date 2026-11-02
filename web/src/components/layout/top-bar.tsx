"use client";

import Link from "next/link";

import { ProfileAvatar, useProfileIdentity } from "@/components/profile/profile-identity";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function TopBar() {
  const { name } = useProfileIdentity();
  return (
    <div className="flex h-16 items-center justify-end gap-3">
      <ThemeToggle />
      <Link
        href="/profil"
        aria-label="Mon profil"
        title={name ?? "Mon profil"}
        className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-surface-hover"
      >
        <ProfileAvatar size={36} />
      </Link>
    </div>
  );
}
