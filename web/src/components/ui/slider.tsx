"use client";

import { useId } from "react";

/** Curseur à pas entiers, avec la valeur affichée à droite du libellé. */
export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  format = String,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
}) {
  const id = useId();
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        <span className="text-[13px] font-medium tabular-nums text-accent-strong">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={max <= min}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--fill": `${percent}%` } as React.CSSProperties}
        className="slider h-6 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default disabled:opacity-60"
      />
      {hint && <p className="text-xs text-text-tertiary">{hint}</p>}
    </div>
  );
}
