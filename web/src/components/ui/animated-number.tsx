"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const formatter = new Intl.NumberFormat("fr-FR");

/** Compteur qui monte jusqu'à sa valeur quand il apparaît à l'écran. */
export function AnimatedNumber({
  value,
  suffix = "",
  format = (n: number) => formatter.format(Math.round(n)),
}: {
  value: number;
  suffix?: string;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [inView, reduceMotion, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {format(display)}
      {suffix}
    </span>
  );
}
