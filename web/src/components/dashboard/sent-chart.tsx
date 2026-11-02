"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { ticks, type ChartBar } from "@/lib/dashboard";

const HEIGHT = 420;
const PAD = { top: 20, right: 8, bottom: 28, left: 28 };
const RADIUS = 4;

/** Barre au sommet arrondi, posée sur la ligne de base. */
function barPath(x: number, y: number, width: number, height: number) {
  if (height <= 0) return "";
  const r = Math.min(RADIUS, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** Candidatures envoyées dans le temps : une série, survol et clavier pour lire chaque barre. */
export function SentChart({ bars }: { bars: ChartBar[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(entry.contentRect.width, 280)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(...bars.map((bar) => bar.value), 0);
  const scale = ticks(max);
  const top = scale[scale.length - 1];
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / bars.length;
  const barWidth = Math.max(2, Math.min(28, slot - 4));
  // Pas plus de 8 dates sur l'axe : au-delà, elles se chevauchent.
  const labelEvery = Math.max(1, Math.ceil(bars.length / 8));
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
  const peak = bars.findIndex((bar) => bar.value === max && max > 0);
  const last = bars.length - 1;
  const labelled = new Set([peak, last].filter((index) => index >= 0 && bars[index].value > 0));
  const shown = active ?? null;

  return (
    <div ref={root} className="relative w-full">
      <svg width={width} height={HEIGHT} role="img" aria-label="Candidatures envoyées dans le temps" className="block">
        {scale.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className={tick === 0 ? "stroke-border-strong" : "stroke-border"}
              strokeDasharray={tick === 0 ? undefined : "2 4"}
            />
            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-text-tertiary text-[11px] tabular-nums">
              {tick}
            </text>
          </g>
        ))}
        {bars.map((bar, index) => {
          const x = PAD.left + slot * index + (slot - barWidth) / 2;
          const barTop = y(bar.value);
          const height = PAD.top + plotHeight - barTop;
          const isActive = shown === index;
          return (
            <g key={bar.key}>
              <motion.path
                d={barPath(x, barTop, barWidth, height)}
                initial={reduceMotion ? false : { opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: reduceMotion ? 0 : index * 0.03, type: "spring", stiffness: 260, damping: 30 }}
                style={{ transformOrigin: `0px ${PAD.top + plotHeight}px` }}
                className={isActive ? "fill-accent" : "fill-accent-strong"}
              />
              {labelled.has(index) && (
                <text
                  x={x + barWidth / 2}
                  y={barTop - 6}
                  textAnchor="middle"
                  className="fill-text-secondary text-[11px] font-medium tabular-nums"
                >
                  {bar.value}
                </text>
              )}
              {index % labelEvery === last % labelEvery && (
                <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-text-tertiary text-[11px]">
                  {bar.label}
                </text>
              )}
              {/* Zone de survol plus large que la barre, focusable au clavier. */}
              <rect
                x={PAD.left + slot * index}
                y={PAD.top}
                width={slot}
                height={plotHeight}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${bar.detail} : ${bar.value} envoyée${bar.value > 1 ? "s" : ""}`}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none"
              />
            </g>
          );
        })}
      </svg>
      {shown !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-[12px] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.3)]"
          style={{
            left: PAD.left + slot * shown + slot / 2,
            top: y(bars[shown].value) - 10,
          }}
        >
          <span className="text-text-secondary">{bars[shown].detail}</span>
          <span className="ml-2 font-medium tabular-nums text-text">{bars[shown].value}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>Candidatures envoyées dans le temps</caption>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.key}>
              <th scope="row">{bar.detail}</th>
              <td>{bar.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
