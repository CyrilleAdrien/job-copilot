"use client";

import { Menu, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CreateMenu } from "@/components/layout/create-menu";
import { spring } from "@/lib/motion";
import { isActive, mainNav, secondaryNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "sidebar:collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
  }, []);

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
            <Sparkles className="size-[18px] text-accent" strokeWidth={2} aria-hidden />
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
    </aside>
  );
}

function NavGroup({ items, pathname, collapsed }: { items: NavItem[]; pathname: string; collapsed: boolean }) {
  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? item.label : undefined}
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
          </Link>
        );
      })}
    </div>
  );
}
