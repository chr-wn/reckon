import { fmtValue, type ValueContext } from "@/lib/format";
import { cn } from "../ui";

export interface StripRow {
  key: string;
  name: string;
  /** null for a best guess without a range: drawn as a dot only */
  low: number | null;
  median: number;
  high: number | null;
  emphasis?: "you" | "group";
  note?: string;
}

const DURATION_TICKS = [1, 2, 5, 10, 15, 30, 60, 120, 240, 480, 720, 1440, 2880, 4320, 10080, 20160, 43200, 86400, 129600, 259200, 525600];

function niceLinear(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function niceLog(min: number, max: number, duration: boolean): number[] {
  const cands = duration
    ? DURATION_TICKS
    : Array.from({ length: 25 }, (_, i) => [1, 2, 5].map((m) => m * 10 ** (i - 8))).flat();
  let ticks = cands.filter((v) => v >= min && v <= max);
  while (ticks.length > 6) ticks = ticks.filter((_, i) => i % 2 === 0);
  return ticks;
}

function dayTicks(min: number, max: number): number[] {
  const day = 864e5;
  const spanDays = (max - min) / day;
  const step = Math.max(1, Math.ceil(spanDays / 4)) * day;
  const start = new Date(min);
  start.setHours(12, 0, 0, 0);
  const out: number[] = [];
  for (let v = start.getTime() + (start.getTime() < min ? day : 0); v <= max; v += step) out.push(v);
  return out;
}

/**
 * Everyone's interval on one axis: bar = low→high, dot = best guess, vertical
 * line = what actually happened. Values are printed, so nothing hides behind hover.
 */
export function IntervalStrip({
  rows,
  actual,
  scaleType,
  q,
  tz,
}: {
  rows: StripRow[];
  actual?: number | null;
  scaleType: "linear" | "log";
  q: ValueContext;
  tz: string;
}) {
  if (!rows.length) return null;
  const vals = rows.flatMap((r) => [r.low ?? r.median, r.high ?? r.median]).concat(actual != null ? [actual] : []);
  const log = scaleType === "log";
  const tf = (v: number) => (log ? Math.log(Math.max(v, 1e-9)) : v);
  let lo = Math.min(...vals.map(tf));
  let hi = Math.max(...vals.map(tf));
  const pad = (hi - lo || Math.abs(lo) || 1) * 0.08;
  lo -= pad;
  hi += pad;
  // Rounded so server and browser agree exactly (see chart-kit `scale`).
  const pos = (v: number) => Math.round(((tf(v) - lo) / (hi - lo)) * 100000) / 1000;
  const inv = (u: number) => (log ? Math.exp(u) : u);
  const ticks =
    q.type === "date" ? dayTicks(inv(lo), inv(hi)) : log ? niceLog(inv(lo), inv(hi), q.type === "duration") : niceLinear(lo, hi);
  const v = (x: number) => fmtValue(q, x, tz);
  // axis ticks sit on days even when forecasts carry a time of day
  const tick = (x: number) => (q.type === "date" ? fmtValue({ type: "date" }, x, tz) : v(x));

  return (
    <div>
      <div className="relative">
        <div className="space-y-3">
          {rows.map((r) => {
            const color = r.emphasis === "you" ? "var(--series-1)" : r.emphasis === "group" ? "var(--ink)" : "var(--ink-3)";
            const hit = actual != null && r.low != null && r.high != null ? actual >= r.low && actual <= r.high : null;
            return (
              <div key={r.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className={cn("truncate", r.emphasis ? "font-medium text-ink" : "text-ink-2")}>
                    {r.name}
                    {hit != null && <span className={cn("ml-1.5 text-xs", hit ? "text-good-ink" : "text-bad-ink")}>{hit ? "✓" : "✗"}</span>}
                  </span>
                  <span className="shrink-0 tnum text-ink-2">
                    <span className="font-semibold text-ink">{v(r.median)}</span>{" "}
                    {r.low != null && r.high != null && (
                      <span className="text-ink-3">
                        ({v(r.low)}–{v(r.high)})
                      </span>
                    )}
                  </span>
                </div>
                <div className="relative h-3">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--grid)]" />
                  {r.low != null && r.high != null && (
                    <div
                      className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                      style={{ left: `${pos(r.low)}%`, width: `${Math.max(0.8, pos(r.high) - pos(r.low))}%`, background: color, opacity: 0.35 }}
                    />
                  )}
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
                    style={{ left: `${pos(r.median)}%`, background: color }}
                  />
                  {actual != null && (
                    <div className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 -translate-x-1/2 rounded bg-ink" style={{ left: `${pos(actual)}%` }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="relative mt-2 h-5 border-t border-[var(--axis)] text-[11px] text-ink-3 tnum">
        {ticks.map((t) => (
          <span key={t} className="absolute top-1 -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(t)}%` }}>
            {tick(t)}
          </span>
        ))}
      </div>
      {actual != null && (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
          <span className="inline-block h-3 w-0.5 rounded bg-ink" /> Actual: <span className="font-semibold text-ink">{v(actual)}</span>
        </p>
      )}
    </div>
  );
}
