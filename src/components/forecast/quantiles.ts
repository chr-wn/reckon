import type { DurationUnit } from "@/lib/constants";
import { fromMinutes, toMinutes } from "@/lib/format";
import type { Quantiles } from "@/lib/scoring/continuous";

export type ContinuousKind = "numeric" | "duration" | "date";

/** What the user has typed: strings, so half-typed values don't get clobbered. */
export interface QuantileDraft {
  low: string;
  median: string;
  high: string;
}

export const EMPTY_DRAFT: QuantileDraft = { low: "", median: "", high: "" };

const pad = (n: number) => String(n).padStart(2, "0");

/** yyyy-mm-dd, in `tz` if given (use it for anything rendered on the server), else browser-local. */
export function toDateInput(ms: number, tz?: string): string {
  if (tz) {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
  }
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Dates are stored as local noon so "Oct 3" means Oct 3 in the forecaster's time zone. */
export function fromDateInput(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).getTime();
}

function parseOne(kind: ContinuousKind, s: string, unit: DurationUnit): number | null {
  if (kind === "date") return fromDateInput(s);
  const v = Number(s.replace(/,/g, "").trim());
  if (s.trim() === "" || !Number.isFinite(v)) return null;
  return kind === "duration" ? toMinutes(v, unit) : v;
}

export function parseDraft(kind: ContinuousKind, d: QuantileDraft, unit: DurationUnit = "minutes") {
  const low = parseOne(kind, d.low, unit);
  const median = parseOne(kind, d.median, unit);
  const high = parseOne(kind, d.high, unit);
  const complete = low != null && median != null && high != null;
  let error: string | null = null;
  if (complete) {
    if (!(low <= median && median <= high)) error = "Order should be low ≤ best guess ≤ high.";
    else if (low >= high) error = "Give yourself a range — low and high can't be equal.";
    else if (kind === "duration" && low <= 0) error = "Durations must be more than zero.";
  }
  const quantiles: Quantiles | null = complete && !error ? { low, median, high } : null;
  return { quantiles, error, partial: { low, median, high } };
}

const trimNum = (x: number) => {
  const r = Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 100) / 100;
  return String(r);
};

export function toDraft(kind: ContinuousKind, q: Quantiles, unit: DurationUnit = "minutes", tz?: string): QuantileDraft {
  const one = (v: number) =>
    kind === "date" ? toDateInput(v, tz) : kind === "duration" ? trimNum(fromMinutes(v, unit)) : trimNum(v);
  return { low: one(q.low), median: one(q.median), high: one(q.high) };
}
