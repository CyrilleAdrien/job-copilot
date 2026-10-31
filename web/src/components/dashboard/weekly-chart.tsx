"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { ticks, weekLabel, type WeekCount } from "@/lib/dashboard";

const HEIGHT = 300;
const PAD = { top: 20, right: 8, bottom: 28, left: 28 };
const RADIUS = 4;

/** Barre au sommet arrondi, posée sur la ligne de base. */
function barPath(x: number, y: number, width: number, height: number) {
  if (height <= 0) return "";
  const r = Math.min(RADIUS, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** Candidatures envoyées par semaine : une série, survol et clavier pour lire chaque semaine. */
export function WeeklyChart({ weeks }: { weeks: WeekCount[] }) {
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

  const max = Math.max(...weeks.map((week) => week.sent), 0);
  const scale = ticks(max);
  const top = scale[scale.length - 1];
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / weeks.length;
  const barWidth = Math.min(28, slot - 6);
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
  const peak = weeks.findIndex((week) => week.sent === max && max > 0);
  const last = weeks.length - 1;
  const labelled = new Set([peak, last].filter((index) => index >= 0 && weeks[index].sent > 0));
  const shown = active ?? null;

  return (
    <div ref={root} className="relative w-full">
      <svg width={width} height={HEIGHT} role="img" aria-label="Candidatures envoyées par semaine" className="block">
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
        {weeks.map((week, index) => {
          const x = PAD.left + slot * index + (slot - barWidth) / 2;
          const barTop = y(week.sent);
          const height = PAD.top + plotHeight - barTop;
          const isActive = shown === index;
          return (
            <g key={week.week}>
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
                  {week.sent}
                </text>
              )}
              {(index % 2 === last % 2 || weeks.length <= 6) && (
                <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-text-tertiary text-[11px]">
                  {weekLabel(week.week)}
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
                aria-label={`Semaine du ${weekLabel(week.week)} : ${week.sent} envoyée${week.sent > 1 ? "s" : ""}`}
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
            top: y(weeks[shown].sent) - 10,
          }}
        >
          <span className="text-text-secondary">Semaine du {weekLabel(weeks[shown].week)}</span>
          <span className="ml-2 font-semibold tabular-nums text-text">{weeks[shown].sent}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>Candidatures envoyées par semaine</caption>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.week}>
              <th scope="row">Semaine du {weekLabel(week.week)}</th>
              <td>{week.sent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
