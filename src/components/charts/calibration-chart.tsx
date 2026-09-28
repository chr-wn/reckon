"use client";

import { pct } from "@/lib/format";
import type { CalibrationBin } from "@/lib/scoring/binary";
import { ChartFrame, DataTable, scale, useTip } from "./chart-kit";

const fmtN = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

/**
 * Forecast probability (x) vs. how often it happened (y). Dots on the diagonal
 * = calibrated; below = overconfident on YES; whiskers are 90% intervals, so
 * small bins don't get over-read. A strip underneath shows how often you use
 * each probability.
 */
export function CalibrationChart({ bins, mini = false, label = "Calibration chart" }: { bins: CalibrationBin[]; mini?: boolean; label?: string }) {
  const [tip, setTip] = useTip();
  const W = mini ? 200 : 440;
  const plot = mini ? 168 : 320;
  const left = mini ? 26 : 48;
  const top = mini ? 8 : 14;
  const stripH = mini ? 0 : 34;
  const H = top + plot + (mini ? 24 : 30) + stripH + (mini ? 0 : 26);
  const x = scale(0, 1, left, left + plot);
  const y = scale(0, 1, top + plot, top);
  const used = bins.filter((b) => b.n > 0);
  const maxN = Math.max(1, ...bins.map((b) => b.n));
  const ticks = mini ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
  const stripTop = top + plot + 30;
  // Dot area grows with the number of forecasts, so a 2-forecast bin can't shout as loud as a 20-forecast one.
  const dotR = (n: number) => (mini ? 2.5 : 3.5) + Math.min(mini ? 3 : 4, Math.sqrt(n / maxN) * (mini ? 3 : 4));
  const show = (b: CalibrationBin) =>
    setTip({
      x: x(b.meanP),
      y: y(b.freq),
      content: (
        <>
          <div className="font-semibold text-ink">
            {pct(b.freq)} happened <span className="font-normal text-ink-3">· {fmtN(b.n)} forecasts</span>
          </div>
          <div>When you said ≈{pct(b.center)} (avg {pct(b.meanP)})</div>
          {!mini && (
            <div className="text-ink-3">
              90% range: {pct(b.ciLow)}–{pct(b.ciHigh)}
            </div>
          )}
        </>
      ),
    });

  return (
    <ChartFrame width={W} height={H} tip={tip} label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
          <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} stroke="var(--grid)" strokeWidth={1} />
          <text x={left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={mini ? 9 : 11} fill="var(--ink-3)" className="tnum">
            {pct(t)}
          </text>
          <text x={x(t)} y={top + plot + (mini ? 14 : 16)} textAnchor="middle" fontSize={mini ? 9 : 11} fill="var(--ink-3)" className="tnum">
            {pct(t)}
          </text>
        </g>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--axis)" strokeWidth={1.5} />
      {!mini && (
        <text
          x={x(0.8)}
          y={y(0.8) - 7}
          fontSize={10.5}
          fill="var(--ink-3)"
          textAnchor="middle"
          transform={`rotate(-45 ${x(0.8)} ${y(0.8) - 7})`}
        >
          perfectly calibrated
        </text>
      )}

      {!mini && used.length > 1 && (
        <polyline
          points={used.map((b) => `${x(b.meanP)},${y(b.freq)}`).join(" ")}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeOpacity={0.3}
          strokeLinejoin="round"
        />
      )}
      {used.map((b) => (
        <g key={b.center}>
          {!mini && (
            <line
              x1={x(b.meanP)}
              x2={x(b.meanP)}
              y1={y(b.ciLow)}
              y2={y(b.ciHigh)}
              stroke="var(--series-1)"
              strokeOpacity={0.35}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )}
          <circle cx={x(b.meanP)} cy={y(b.freq)} r={dotR(b.n)} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          <circle
            cx={x(b.meanP)}
            cy={y(b.freq)}
            r={14}
            fill="transparent"
            tabIndex={mini ? -1 : 0}
            onPointerEnter={() => show(b)}
            onFocus={() => show(b)}
            onPointerLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
          />
        </g>
      ))}

      {!mini && (
        <>
          <text x={left + plot / 2} y={H - 2} textAnchor="middle" fontSize={11.5} fill="var(--ink-2)">
            Your forecast
          </text>
          <text
            x={12}
            y={top + plot / 2}
            textAnchor="middle"
            fontSize={11.5}
            fill="var(--ink-2)"
            transform={`rotate(-90 12 ${top + plot / 2})`}
          >
            How often it happened
          </text>
          {bins.map((b) => {
            const h = (b.n / maxN) * (stripH - 8);
            const bw = Math.min(18, plot / 11 - 6);
            return (
              <g key={`s${b.center}`}>
                {b.n > 0 && (
                  <rect x={x(b.center) - bw / 2} y={stripTop + stripH - 8 - h} width={bw} height={Math.max(2, h)} rx={2} fill="var(--ink-3)" opacity={0.4}>
                    <title>{`${fmtN(b.n)} forecasts near ${pct(b.center)}`}</title>
                  </rect>
                )}
              </g>
            );
          })}
          <text x={left - 6} y={stripTop + stripH - 10} textAnchor="end" fontSize={10} fill="var(--ink-3)">
            usage
          </text>
        </>
      )}
    </ChartFrame>
  );
}

export function CalibrationTable({ bins }: { bins: CalibrationBin[] }) {
  return (
    <DataTable
      head={["You said", "Forecasts", "Avg forecast", "Happened", "90% range"]}
      rows={bins
        .filter((b) => b.n > 0)
        .map((b) => [`≈${pct(b.center)}`, fmtN(b.n), pct(b.meanP), pct(b.freq), `${pct(b.ciLow)}–${pct(b.ciHigh)}`])}
    />
  );
}
