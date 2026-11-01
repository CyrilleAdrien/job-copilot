"use client";

import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ProfileAvatar, useProfileIdentity } from "@/components/profile/profile-identity";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { spring } from "@/lib/motion";
import { isActive, mainNav, secondaryNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { name } = useProfileIdentity();

  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 backdrop-blur-xl">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2.5">
        <span className="flex size-7 items-center justify-center rounded-lg bg-text text-background">
          <Sparkles className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">job-copilot</span>
      </Link>

      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-6">
        <NavGroup items={mainNav} pathname={pathname} />
        <NavGroup items={secondaryNav} pathname={pathname} title="Espace" />
      </nav>

      <Link
        href="/profil"
        aria-label="Mon profil"
        className="mt-4 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors duration-150 hover:bg-surface-hover"
      >
        <ProfileAvatar size={28} />
        <span className="min-w-0 truncate text-[13px] font-medium">{name ?? "Mon profil"}</span>
      </Link>

      <div className="flex items-center justify-between px-2.5 pt-3">
        <span className="text-xs text-text-tertiary">Apparence</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function NavGroup({
  items,
  pathname,
  title,
}: {
  items: NavItem[];
  pathname: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {title && (
        <span className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          {title}
        </span>
      )}
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors duration-150",
              active ? "font-medium text-text" : "text-text-secondary hover:text-text",
            )}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-lg bg-surface-hover"
                transition={spring.snappy}
              />
            )}
            {active && (
              <motion.span
                layoutId="sidebar-indicator"
                className="absolute left-0 top-2 h-5 w-[3px] rounded-full bg-accent"
                transition={spring.snappy}
              />
            )}
            <Icon
              className={cn("relative size-[18px]", active && "text-accent-strong")}
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
