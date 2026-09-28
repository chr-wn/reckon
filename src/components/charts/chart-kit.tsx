"use client";

import { useState, type ReactNode } from "react";
import { cn } from "../ui";

/**
 * Linear scale helper. Output is rounded to 0.01px: Math.log/exp can differ in
 * the last bit between Node and the browser, which would otherwise make
 * server-rendered SVG coordinates fail hydration.
 */
export function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  return (v: number) => Math.round((r0 + (v - d0) * k) * 100) / 100;
}

/** Round-number ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const mag = 10 ** Math.floor(Math.log10(span / count));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => span / st <= count) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/** Column with rounded data-end, square at the baseline. */
export function barPath(x: number, baseline: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${baseline} V${baseline - h + rr} Q${x},${baseline - h} ${x + rr},${baseline - h} H${x + w - rr} Q${x + w},${baseline - h} ${x + w},${baseline - h + rr} V${baseline} Z`;
}

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

/** Positions an HTML tooltip over an SVG drawn in a W×H viewBox. */
export function ChartFrame({
  width,
  height,
  tip,
  children,
  className,
  label,
}: {
  width: number;
  height: number;
  tip: TipState | null;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full overflow-visible" role="img" aria-label={label}>
        {children}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute z-20 w-max max-w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-line bg-surface px-2.5 py-2 text-xs leading-relaxed text-ink-2 shadow-card"
          style={{ left: `${(tip.x / width) * 100}%`, top: `${(tip.y / height) * 100}%` }}
        >
          {tip.content}
        </div>
      )}
    </div>
  );
}

export function useTip() {
  return useState<TipState | null>(null);
}

/** A figure with a title and a chart ⇄ table toggle (the accessible twin of every chart). */
export function Figure({
  title,
  subtitle,
  table,
  children,
  className,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={cn("rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5", className)}>
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 text-sm text-ink-3">{subtitle}</div>}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            aria-pressed={showTable}
          >
            {showTable ? "Chart" : "Table"}
          </button>
        )}
      </figcaption>
      {showTable ? <div className="overflow-x-auto">{table}</div> : children}
      {footer && <div className="mt-3 text-sm text-ink-2">{footer}</div>}
    </figure>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full text-sm tnum">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink-3">
          {head.map((h) => (
            <th key={h} className="py-1.5 pr-3 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line/60 last:border-0">
            {r.map((c, j) => (
              <td key={j} className="py-1.5 pr-3 text-ink-2">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
