"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Apparence"
      className="flex rounded-full border border-border bg-background-subtle p-0.5"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative flex size-7 items-center justify-center rounded-full transition-colors",
              selected ? "text-text" : "text-text-tertiary hover:text-text",
            )}
          >
            {selected && (
              <motion.span
                layoutId="theme-toggle"
                className="absolute inset-0 rounded-full border border-border bg-surface shadow-card"
                transition={spring.snappy}
              />
            )}
            <Icon className="relative size-3.5" strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
