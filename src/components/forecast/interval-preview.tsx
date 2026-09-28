"use client";

import { useId } from "react";
import { fmtValue } from "@/lib/format";
import { twoPiece, type Quantiles, type Scale } from "@/lib/scoring/continuous";
import type { ContinuousKind } from "./quantiles";

/**
 * A small sketch of the distribution implied by low / best guess / high:
 * the shaded band is the stated interval, the curve shows how lopsided it is.
 * Optionally overlays a suggested (track-record adjusted) interval.
 */
export function IntervalPreview({
  kind,
  q,
  confidence,
  scale,
  unit,
  tz,
  suggestion,
}: {
  kind: ContinuousKind;
  q: Quantiles;
  confidence: number;
  scale: Scale;
  unit?: string | null;
  tz: string;
  suggestion?: Quantiles | null;
}) {
  const clipId = useId();
  const W = 560;
  const H = 76;
  const PAD = 12;
  const base = H - 20;
  const { m, sL, sR } = twoPiece(q, confidence, scale);
  let lo = m - 3 * sL;
  let hi = m + 3 * sR;
  if (suggestion) {
    const s = twoPiece(suggestion, confidence, scale);
    lo = Math.min(lo, s.m - 3 * s.sL);
    hi = Math.max(hi, s.m + 3 * s.sR);
  }
  if (scale === "log") {
    // keep the axis sane when a huge spread is entered
    lo = Math.max(lo, m - 6);
    hi = Math.min(hi, m + 6);
  }
  const x = (u: number) => Math.round((PAD + ((u - lo) / (hi - lo)) * (W - 2 * PAD)) * 100) / 100;
  const toU = (v: number) => (scale === "log" ? Math.log(v) : v);

  // Smooth split-normal outline (visual only).
  const pts: string[] = [];
  const peak = base - 6;
  for (let i = 0; i <= 120; i++) {
    const u = lo + ((hi - lo) * i) / 120;
    const s = u < m ? sL : sR;
    const dens = Math.exp(-((u - m) ** 2) / (2 * s * s));
    pts.push(`${x(u).toFixed(1)},${(base - dens * (peak - 8)).toFixed(1)}`);
  }
  const outline = `M${pts.join(" L")}`;
  const lx = x(toU(q.low));
  const hx = x(toU(q.high));
  const mx = x(toU(q.median));
  const label = (v: number) => fmtValue({ type: kind, unit }, v, tz);
  const sLow = suggestion ? x(toU(suggestion.low)) : 0;
  const sHigh = suggestion ? x(toU(suggestion.high)) : 0;
  const sMed = suggestion ? x(toU(suggestion.median)) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label="Distribution sketch of your forecast">
      <defs>
        <clipPath id={clipId}>
          <rect x={lx} y={0} width={Math.max(0, hx - lx)} height={base} />
        </clipPath>
      </defs>
      <path d={`${outline} L${x(hi)},${base} L${x(lo)},${base} Z`} fill="var(--accent)" opacity={0.08} />
      <path d={`${outline} L${x(hi)},${base} L${x(lo)},${base} Z`} fill="var(--accent)" opacity={0.18} clipPath={`url(#${clipId})`} />
      <path d={outline} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      <line x1={PAD} x2={W - PAD} y1={base} y2={base} stroke="var(--axis)" strokeWidth={1} />
      <line x1={mx} x2={mx} y1={base} y2={14} stroke="var(--accent)" strokeWidth={2} />
      {suggestion && (
        <g>
          <line x1={sLow} x2={sHigh} y1={base + 7} y2={base + 7} stroke="var(--series-2)" strokeWidth={3} strokeLinecap="round" />
          <circle cx={sMed} cy={base + 7} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
        </g>
      )}
      <g fontSize={11} fill="var(--ink-3)" className="tnum">
        <text x={lx} y={H - 1} textAnchor="middle">
          {label(q.low)}
        </text>
        <text x={hx} y={H - 1} textAnchor="middle">
          {label(q.high)}
        </text>
        <text x={mx} y={10} textAnchor="middle" fill="var(--ink-2)" fontWeight={600}>
          {label(q.median)}
        </text>
      </g>
    </svg>
  );
}

