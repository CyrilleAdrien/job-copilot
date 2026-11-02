"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { ticks, type ChartBar } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export type ChartKind = "bar" | "line";

const HEIGHT = 344;
const PAD = { top: 20, right: 8, bottom: 32, left: 28 };
const RADIUS = 4;
const MIN_LABEL_WIDTH = 44;

/** Barre au sommet arrondi, posée sur la ligne de base. */
function barPath(x: number, y: number, width: number, height: number) {
  if (height <= 0) return "";
  const r = Math.min(RADIUS, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** Candidatures envoyées dans le temps : une série, survol et clavier pour lire chaque barre. */
export function SentChart({ bars, kind }: { bars: ChartBar[]; kind: ChartKind }) {
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
  // Autant de dates que la largeur en permet, pour ne jamais les faire se chevaucher.
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(1, Math.floor(plotWidth / MIN_LABEL_WIDTH))));
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
  const peak = bars.findIndex((bar) => bar.value === max && max > 0);
  const last = bars.length - 1;
  const labelled = new Set([peak, last].filter((index) => index >= 0 && bars[index].value > 0));
  const shown = active ?? null;
  const center = (index: number) => PAD.left + slot * index + slot / 2;
  const baseline = PAD.top + plotHeight;
  // La courbe s'arrête au moment présent : l'avenir n'est pas un zéro.
  const nowIndex = bars.findIndex((bar) => bar.current);
  const pastBars = nowIndex >= 0 ? bars.slice(0, nowIndex + 1) : bars;
  const linePath = pastBars.map((bar, index) => `${index === 0 ? "M" : "L"}${center(index)},${y(bar.value)}`).join("");
  // Une tranche active garde toujours sa date. Quand la place manque, ses voisines s'effacent.
  const showsLabel = (index: number) =>
    bars[index].value > 0 || labelEvery === 1 || (index % labelEvery === last % labelEvery && !(bars[index - 1]?.value > 0) && !(bars[index + 1]?.value > 0));

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
        {bars.map(
          (bar, index) =>
            bar.current && <rect key="now" x={PAD.left + slot * index + 1} y={PAD.top} width={Math.max(slot - 2, 1)} height={plotHeight} rx={6} className="fill-accent-soft" />,
        )}
        {kind === "line" && (
          <motion.path
            d={linePath}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
            className="stroke-accent-strong"
          />
        )}
        {bars.map((bar, index) => {
          const x = center(index) - barWidth / 2;
          const barTop = y(bar.value);
          const height = baseline - barTop;
          const isActive = shown === index;
          const hasActivity = bar.value > 0;
          return (
            <g key={bar.key}>
              {kind === "bar" ? (
                <motion.path
                  d={barPath(x, barTop, barWidth, height)}
                  initial={reduceMotion ? false : { opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: reduceMotion ? 0 : index * 0.03, type: "spring", stiffness: 260, damping: 30 }}
                  style={{ transformOrigin: `0px ${baseline}px` }}
                  className={isActive ? "fill-accent" : "fill-accent-strong"}
                />
              ) : (
                (hasActivity || isActive) && (
                  <circle cx={center(index)} cy={barTop} r={isActive ? 6 : 4.5} strokeWidth={2} className={cn("stroke-surface transition-[r] duration-150", isActive ? "fill-accent" : "fill-accent-strong")} />
                )
              )}
              {labelled.has(index) && (
                <text x={center(index)} y={barTop - (kind === "line" ? 11 : 6)} textAnchor="middle" className="fill-text-secondary text-[11px] font-medium tabular-nums">
                  {bar.value}
                </text>
              )}
              {showsLabel(index) && (
                <text x={center(index)} y={HEIGHT - 12} textAnchor="middle" className={cn("text-[11px]", hasActivity || bar.current ? "fill-text font-medium" : "fill-text-tertiary")}>
                  {bar.label}
                </text>
              )}
              {hasActivity && <rect aria-hidden x={center(index) - 9} y={HEIGHT - 6} width={18} height={3} rx={1.5} className="fill-accent" />}
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
