"use client";

import { pct } from "@/lib/format";
import { barPath, ChartFrame, scale, useTip } from "./chart-kit";

/**
 * Where reality landed within your forecast distributions, in deciles.
 * Calibrated → flat at 10%. U-shape → intervals too narrow. Lopsided → bias.
 */
export function PitHistogram({ pit, counts }: { pit: number[]; counts: number[] }) {
  const [tip, setTip] = useTip();
  const W = 440;
  const H = 210;
  const left = 38;
  const right = W - 64;
  const top = 12;
  const bottom = H - 44;
  const yMax = Math.max(0.3, Math.ceil(Math.max(...pit) * 10 + 0.5) / 10);
  const y = scale(0, yMax, bottom, top);
  const bw = (right - left) / 10;
  const barW = Math.min(24, bw - 4);
  const ticks = [0, 0.1, 0.2, 0.3, 0.4, 0.5].filter((t) => t <= yMax + 1e-9);

  return (
    <ChartFrame width={W} height={H} tip={tip} label="Where outcomes landed within your forecast ranges">
      <rect x={left} y={top} width={bw} height={bottom - top} fill="var(--bad)" opacity={0.05} />
      <rect x={right - bw} y={top} width={bw} height={bottom - top} fill="var(--bad)" opacity={0.05} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
          <text x={left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="var(--ink-3)" className="tnum">
            {pct(t)}
          </text>
        </g>
      ))}
      {pit.map((p, i) => {
        const x0 = left + i * bw + (bw - barW) / 2;
        const h = Math.max(0, bottom - y(p));
        return (
          <g key={i}>
            {h > 0 && <path d={barPath(x0, bottom, barW, Math.max(2, h))} fill="var(--series-1)" />}
            <rect
              x={left + i * bw}
              y={top}
              width={bw}
              height={bottom - top}
              fill="transparent"
              onPointerEnter={() =>
                setTip({
                  x: x0 + barW / 2,
                  y: y(p),
                  content: (
                    <>
                      <div className="font-semibold text-ink">
                        {pct(p)} of outcomes <span className="font-normal text-ink-3">({Math.round(counts[i] * 10) / 10})</span>
                      </div>
                      <div>
                        landed at the {i * 10}–{i * 10 + 10}th percentile of your forecast
                      </div>
                      <div className="text-ink-3">calibrated ≈ 10%</div>
                    </>
                  ),
                })
              }
              onPointerLeave={() => setTip(null)}
            />
          </g>
        );
      })}
      <line x1={left} x2={right} y1={y(0.1)} y2={y(0.1)} stroke="var(--ink)" strokeWidth={1.5} />
      <text x={right + 6} y={y(0.1) + 3.5} fontSize={10.5} fill="var(--ink-2)">
        calibrated
      </text>
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--axis)" strokeWidth={1} />
      <line x1={(left + right) / 2} x2={(left + right) / 2} y1={bottom} y2={bottom + 5} stroke="var(--axis)" />
      <g fontSize={11} fill="var(--ink-3)">
        <text x={left} y={bottom + 18}>
          ← came in lower
        </text>
        <text x={right} y={bottom + 18} textAnchor="end">
          came in higher →
        </text>
        <text x={(left + right) / 2} y={bottom + 18} textAnchor="middle" fill="var(--ink-2)">
          your median
        </text>
        <text x={left + bw / 2} y={bottom + 34} textAnchor="middle" fontSize={10}>
          far tail
        </text>
        <text x={right - bw / 2} y={bottom + 34} textAnchor="middle" fontSize={10}>
          far tail
        </text>
      </g>
    </ChartFrame>
  );
}
