import { pct } from "@/lib/format";
import type { CoverageLevel } from "@/lib/scoring/continuous";

/**
 * How often reality landed inside your stated intervals, per confidence level.
 * Fill = actual hit rate, tick = where it should be, whisker = 90% range.
 */
export function CoverageBars({ levels }: { levels: CoverageLevel[] }) {
  return (
    <div className="space-y-4">
      {levels.map((l) => {
        const off = l.hitRate - l.confidence;
        const verdict = l.ciHigh < l.confidence ? "too narrow" : l.ciLow > l.confidence ? "too wide" : "on target";
        return (
          <div key={l.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{l.label} intervals</span>
              <span className="tnum text-ink-2">
                <span className="font-semibold text-ink">{pct(l.hitRate)}</span> caught · n={Math.round(l.n)} ·{" "}
                <span className={verdict === "on target" ? "text-good-ink" : "text-bad-ink"}>{verdict}</span>
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-surface-3" role="img" aria-label={`${pct(l.hitRate)} of ${l.label} intervals contained the answer`}>
              <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--series-1)]" style={{ width: `${Math.max(1.5, l.hitRate * 100)}%` }} />
              <div
                className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/30"
                style={{ left: `${l.ciLow * 100}%`, width: `${Math.max(0.5, (l.ciHigh - l.ciLow) * 100)}%` }}
              />
              <div className="absolute -top-1 -bottom-1 w-[3px] -translate-x-1/2 rounded-full bg-ink" style={{ left: `${l.confidence * 100}%` }} title={`target ${pct(l.confidence)}`} />
            </div>
            {Math.abs(off) >= 0.1 && (
              <p className="mt-1 text-xs text-ink-3">
                {off < 0
                  ? `Reality escaped your ${l.label} ranges ${pct(1 - l.hitRate)} of the time instead of ${pct(1 - l.confidence)}.`
                  : `Your ranges could be tighter — they caught more than they claimed.`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
