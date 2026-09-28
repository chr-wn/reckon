"use client";

import { useRef } from "react";
import { pct } from "@/lib/format";
import { ChartFrame, scale, useTip } from "./chart-kit";

export interface TimelineSeries {
  name: string;
  isYou: boolean;
  points: { t: number; p: number }[];
}

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)", "var(--series-7)", "var(--series-8)"];

const standing = (s: TimelineSeries, t: number) => {
  let cur: number | null = null;
  for (const p of s.points) if (p.t <= t) cur = p.p;
  return cur;
};

/** Everyone's probability over time as step lines; crosshair reads out each person's standing forecast. */
export function ProbabilityTimeline({
  series,
  start,
  end,
  outcome,
  tz,
}: {
  series: TimelineSeries[];
  start: number;
  end: number;
  outcome?: "yes" | "no" | null;
  tz: string;
}) {
  const [tip, setTip] = useTip();
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", timeZone: tz });
  const box = useRef<HTMLDivElement>(null);
  const shown = series.slice(0, 8); // categorical palette tops out at 8 series
  const W = 520;
  const H = 190;
  const left = 40;
  const right = W - 12;
  const top = 10;
  const bottom = H - 24;
  const t1 = Math.max(end, start + 60_000);
  const x = scale(start, t1, left, right);
  const y = scale(0, 1, bottom, top);

  function onMove(e: React.PointerEvent) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const sx = ((e.clientX - r.left) / r.width) * W;
    const t = start + ((Math.min(right, Math.max(left, sx)) - left) / (right - left)) * (t1 - start);
    setTip({
      x: x(t),
      y: top + 4,
      content: (
        <>
          <div className="mb-0.5 text-ink-3">{dateFmt.format(t)}</div>
          {shown.map((s, i) => {
            const p = standing(s, t);
            return (
              <div key={s.name} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES[i] }} />
                <span className="font-semibold text-ink tnum">{p == null ? "–" : pct(p)}</span>
                <span className="truncate">{s.name}</span>
              </div>
            );
          })}
        </>
      ),
    });
  }

  return (
    <div>
      <div ref={box} onPointerMove={onMove} onPointerLeave={() => setTip(null)} className="touch-pan-y">
        <ChartFrame width={W} height={H} tip={tip} label="Forecasts over time">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
              <text x={left - 6} y={y(v) + 3.5} textAnchor="end" fontSize={11} fill="var(--ink-3)" className="tnum">
                {pct(v)}
              </text>
            </g>
          ))}
          <text x={left} y={H - 5} fontSize={11} fill="var(--ink-3)">
            {dateFmt.format(start)}
          </text>
          <text x={right} y={H - 5} fontSize={11} fill="var(--ink-3)" textAnchor="end">
            {dateFmt.format(t1)}
          </text>
          {outcome && (
            <text x={right - 4} y={y(outcome === "yes" ? 1 : 0) + (outcome === "yes" ? 14 : -6)} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--ink-2)">
              resolved {outcome.toUpperCase()}
            </text>
          )}
          {shown.map((s, i) => {
            if (!s.points.length) return null;
            let d = "";
            s.points.forEach((p, j) => {
              const nx = j + 1 < s.points.length ? s.points[j + 1].t : t1;
              d += `${j ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.p).toFixed(1)} H${x(nx).toFixed(1)} `;
            });
            const last = s.points[s.points.length - 1];
            return (
              <g key={s.name}>
                <path d={d} fill="none" stroke={SERIES[i]} strokeWidth={s.isYou ? 2.5 : 2} strokeLinejoin="round" />
                {s.points.map((p) => (
                  <circle key={p.t} cx={x(p.t)} cy={y(p.p)} r={3.5} fill={SERIES[i]} stroke="var(--surface)" strokeWidth={2} />
                ))}
                <circle cx={x(t1)} cy={y(last.p)} r={4} fill={SERIES[i]} stroke="var(--surface)" strokeWidth={2} />
              </g>
            );
          })}
          {tip && <line x1={tip.x} x2={tip.x} y1={top} y2={bottom} stroke="var(--ink-3)" strokeWidth={1} />}
        </ChartFrame>
      </div>
      {shown.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {shown.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES[i] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
