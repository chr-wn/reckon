import { CalendarDays, CircleHelp, Clock3, Hash, type LucideIcon } from "lucide-react";
import type { Question } from "@/lib/db/schema";
import { fmtRatio, fmtValue, pct } from "@/lib/format";
import type { ScoredRecord } from "@/lib/scoring/records";
import { Badge, cn } from "../ui";

const ICONS: Record<Question["type"], LucideIcon> = {
  binary: CircleHelp,
  duration: Clock3,
  numeric: Hash,
  date: CalendarDays,
};

export function TypeIcon({ type, className, size = 16 }: { type: Question["type"]; className?: string; size?: number }) {
  const Icon = ICONS[type];
  return <Icon size={size} className={cn("shrink-0 text-ink-3", className)} aria-hidden />;
}

type ForecastLike = { probability?: number | null; low?: number | null; median?: number | null; high?: number | null };
type QLike = Pick<Question, "type" | "unit">;

/** "70%" or "30m – 1h 30m (~45m)" */
export function ForecastSummary({ q, f, tz, className }: { q: QLike; f: ForecastLike; tz: string; className?: string }) {
  if (q.type === "binary") {
    return <span className={cn("font-semibold tnum text-ink", className)}>{f.probability != null ? pct(f.probability) : "–"}</span>;
  }
  if (f.low == null || f.median == null || f.high == null) return <span className={className}>–</span>;
  const v = (x: number) => fmtValue(q, x, tz);
  return (
    <span className={cn("tnum text-ink-2", className)}>
      <span className="font-semibold text-ink">{v(f.median)}</span>
      <span className="text-ink-3">
        {" "}
        ({v(f.low)}–{v(f.high)})
      </span>
    </span>
  );
}

export function OutcomeBadge({ q, tz }: { q: Pick<Question, "type" | "unit" | "resolution" | "resolutionValue">; tz: string }) {
  // Outcomes are neutral facts, not good/bad; green/red is reserved for how *you* did.
  if (q.resolution === "yes") return <Badge tone="accent">Resolved yes</Badge>;
  if (q.resolution === "no") return <Badge tone="outline">Resolved no</Badge>;
  if (q.resolution === "ambiguous") return <Badge tone="neutral">Ambiguous</Badge>;
  if (q.resolution === "value" && q.resolutionValue != null) return <Badge tone="accent">= {fmtValue(q, q.resolutionValue, tz)}</Badge>;
  return null;
}

/** Brier: 0 is perfect, 0.25 = always saying 50%. */
export function brierTone(b: number): "good" | "neutral" | "bad" {
  return b <= 0.1 ? "good" : b > 0.25 ? "bad" : "neutral";
}

export function RecordBadge({ r }: { r: ScoredRecord }) {
  if (r.kind === "binary") {
    return (
      <Badge tone={brierTone(r.brier)} title="Brier score: 0 is perfect, 0.25 is what always saying 50% gets you">
        Brier {r.brier.toFixed(2)}
      </Badge>
    );
  }
  if (r.hit >= 0.5) return <Badge tone="good">✓ In range</Badge>;
  const direction = r.z > 0 ? "high" : "low";
  const detail =
    r.type === "duration" && r.ratio != null
      ? r.ratio >= 1
        ? `${fmtRatio(r.ratio)} longer`
        : `${fmtRatio(1 / r.ratio)} quicker`
      : r.type === "date"
        ? direction === "high"
          ? "later"
          : "earlier"
        : direction === "high"
          ? "higher"
          : "lower";
  return <Badge tone="bad">✗ Missed · {detail}</Badge>;
}
