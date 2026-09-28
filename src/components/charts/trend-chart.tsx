"use client";

import { useRef } from "react";
import { fmtRatio, pct } from "@/lib/format";
import type { TrendPoint } from "@/lib/scoring/records";
import { ChartFrame, niceTicks, scale, useTip } from "./chart-kit";

type Fmt = "pct" | "score" | "ratio";
const format = (v: number, f: Fmt) => (f === "pct" ? pct(v) : f === "ratio" ? fmtRatio(v) : v.toFixed(2).replace(/0$/, ""));

/**
 * Per-question values (faint dots) with a rolling average line, against a
 * target reference. The crosshair snaps to the nearest resolved question.
 */
export function TrendChart({
  points,
  domain,
  log = false,
  fmt,
  target,
  targetLabel,
  valueLabel,
  tz,
}: {
  points: TrendPoint[];
  domain: [number, number];
  log?: boolean;
  fmt: Fmt;
  target?: number;
  targetLabel?: string;
  valueLabel: string;
  /** user's time zone, so server and browser format dates identically */
  tz: string;
}) {
  const [tip, setTip] = useTip();
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: tz });
  const svgBox = useRef<HTMLDivElement>(null);
  const W = 520;
  const H = 210;
  const left = 44;
  const right = W - 10;
  const top = 12;
  const bottom = H - 26;
  const t0 = points[0]?.t ?? 0;
  const t1 = points.length > 1 ? points[points.length - 1].t : t0 + 864e5;
  const x = scale(t0, t1, left + 6, right - 6);
  const tf = (v: number) => (log ? Math.log(v) : v);
  const [d0, d1] = domain;
  const yRaw = scale(tf(d0), tf(d1), bottom, top);
  const y = (v: number) => yRaw(tf(Math.min(d1, Math.max(d0, v))));
  const yTicks = log ? [0.5, 1, 1.5, 2, 3, 4].filter((v) => v >= d0 && v <= d1) : niceTicks(d0, d1, 5);
  const xTicks = points.length > 1 ? [0, 0.5, 1].map((f) => t0 + f * (t1 - t0)) : [t0];
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.rolling).toFixed(1)}`).join(" ");

  function onMove(e: React.PointerEvent) {
    const box = svgBox.current?.getBoundingClientRect();
    if (!box || !points.length) return;
    const sx = ((e.clientX - box.left) / box.width) * W;
    let best = points[0];
    for (const p of points) if (Math.abs(x(p.t) - sx) < Math.abs(x(best.t) - sx)) best = p;
    setTip({
      x: x(best.t),
      y: y(best.rolling),
      content: (
        <>
          <div className="font-semibold text-ink">
            {format(best.rolling, fmt)} <span className="font-normal text-ink-3">rolling</span>
          </div>
          <div className="max-w-52 truncate">{best.title}</div>
          <div className="text-ink-3">
            {valueLabel}: {format(best.value, fmt)} · {dateFmt.format(best.t)}
          </div>
        </>
      ),
    });
  }

  return (
    <div ref={svgBox} onPointerMove={onMove} onPointerLeave={() => setTip(null)} className="touch-pan-y">
      <ChartFrame width={W} height={H} tip={tip} label={`${valueLabel} over time`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={left - 6} y={y(v) + 3.5} textAnchor="end" fontSize={11} fill="var(--ink-3)" className="tnum">
              {format(v, fmt)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={t}
            x={x(t)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--ink-3)"
          >
            {dateFmt.format(t)}
          </text>
        ))}
        {target != null && (
          <g>
            <line x1={left} x2={right} y1={y(target)} y2={y(target)} stroke="var(--ink)" strokeWidth={1.5} strokeOpacity={0.7} />
            {targetLabel && (
              <text x={right} y={y(target) - 5} textAnchor="end" fontSize={10.5} fill="var(--ink-2)">
                {targetLabel}
              </text>
            )}
          </g>
        )}
        {points.map((p) => (
          <circle key={p.questionId + p.t} cx={x(p.t)} cy={y(p.value)} r={3} fill="var(--series-1)" opacity={0.28} />
        ))}
        <path d={line} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {tip && <line x1={tip.x} x2={tip.x} y1={top} y2={bottom} stroke="var(--ink-3)" strokeWidth={1} />}
        {points.length > 0 && (
          <circle
            cx={x(points[points.length - 1].t)}
            cy={y(points[points.length - 1].rolling)}
            r={4.5}
            fill="var(--series-1)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        )}
      </ChartFrame>
    </div>
  );
}
