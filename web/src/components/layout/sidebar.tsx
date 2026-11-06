"use client";

import { Lock, Menu } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CreateMenu } from "@/components/layout/create-menu";
import { ProfileAvatar, useProfileIdentity } from "@/components/profile/profile-identity";
import { useLock } from "@/components/setup/setup-context";
import { spring } from "@/lib/motion";
import { isActive, mainNav, secondaryNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "sidebar:collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { name } = useProfileIdentity();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
  }, []);

  // L'assistant de premier lancement occupe tout l'écran.
  if (pathname === "/configuration") return null;

  function toggle() {
    setCollapsed((current) => {
      localStorage.setItem(COLLAPSED_KEY, String(!current));
      return !current;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 flex h-dvh shrink-0 flex-col border-r border-border bg-sidebar px-3 py-2.5 transition-[width] duration-200",
        collapsed ? "w-[73px]" : "w-[257px]",
      )}
    >
      <div className="mb-2 flex h-11 items-center gap-1.5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-text transition-colors hover:bg-surface-hover"
        >
          <Menu className="size-6" strokeWidth={1.5} aria-hidden />
        </button>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-1.5 whitespace-nowrap">
            <Image src="/icon.svg" alt="" width={24} height={24} unoptimized />
            <span className="text-[22px] font-normal leading-none">job-copilot</span>
          </Link>
        )}
      </div>

      <div className="mb-4">
        <CreateMenu collapsed={collapsed} />
      </div>

      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-3">
        <NavGroup items={mainNav} pathname={pathname} collapsed={collapsed} />
        <div className="mx-3 border-t border-border" />
        <NavGroup items={secondaryNav} pathname={pathname} collapsed={collapsed} />
      </nav>

      <Link
        href="/profil"
        aria-label="Mon profil"
        title={name ?? "Mon profil"}
        className="group mt-3 flex h-12 shrink-0 items-center gap-3 rounded-[12px] px-1.5 transition-colors duration-150 hover:bg-surface-hover"
      >
        <ProfileAvatar size={36} className="transition-transform duration-150 group-hover:scale-105" />
        {!collapsed && <span className="min-w-0 truncate text-sm">{name ?? "Mon profil"}</span>}
      </Link>
    </aside>
  );
}

function NavGroup({ items, pathname, collapsed }: { items: NavItem[]; pathname: string; collapsed: boolean }) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
      ))}
    </div>
  );
}

/** Un écran verrouillé reste cliquable : il dit ce qui manque et où le régler. */
function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const lock = useLock(item.href);
  const label = lock ? `${item.label} (à configurer)` : item.label;
  return (
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed || lock ? label : undefined}
            title={collapsed ? label : lock?.reason}
            className={cn(
              "group relative flex h-11 items-center gap-4 rounded-[12px] px-2.5 text-sm transition-colors duration-150",
              active ? "text-text" : "text-text-secondary hover:bg-surface-hover hover:text-text",
            )}
          >
            {active && (
              <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-[12px] bg-accent-soft" transition={spring.snappy} />
            )}
            <Icon className="relative size-6 shrink-0 transition-transform duration-150 group-hover:scale-110" strokeWidth={1.25} aria-hidden />
            {!collapsed && <span className="relative whitespace-nowrap">{item.label}</span>}
            {lock && (
              <Lock
                className={cn("relative size-3.5 shrink-0 text-text-tertiary", collapsed ? "absolute right-1.5 top-1.5" : "ml-auto")}
                strokeWidth={1.75}
                aria-hidden
              />
            )}
          </Link>
  );
}
