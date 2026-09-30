import type { DurationUnit } from "@/lib/constants";
import { fromMinutes, toMinutes } from "@/lib/format";
import { fromDateTimeInput, toDateTimeInput } from "@/lib/parse-date";
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

/** yyyy-mm-ddThh:mm for <input type="datetime-local">, in `tz` if given, else browser-local. */
export function toDateTimeLocal(ms: number, tz?: string): string {
  if (!tz) return toDateTimeInput(new Date(ms));
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(ms)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Inverse of toDateTimeLocal: wall-clock time in `tz` (else browser-local) → epoch ms. */
export function fromDateTimeLocal(s: string, tz?: string): number | null {
  if (!tz) return fromDateTimeInput(s)?.getTime() ?? null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // tz's offset at a moment = its wall clock then, read as UTC, minus the moment; one refinement covers DST edges
  const offsetAt = (ms: number) => {
    const [date, time] = toDateTimeLocal(ms, tz).split("T");
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    return Date.UTC(y, mo - 1, d, h, mi) - Math.floor(ms / 60000) * 60000;
  };
  const guess = wall - offsetAt(wall);
  return wall - offsetAt(guess);
}

function parseOne(kind: ContinuousKind, s: string, unit: DurationUnit, withTime: boolean, tz?: string): number | null {
  if (kind === "date") return withTime ? fromDateTimeLocal(s, tz) : fromDateInput(s);
  const v = Number(s.replace(/,/g, "").trim());
  if (s.trim() === "" || !Number.isFinite(v)) return null;
  return kind === "duration" ? toMinutes(v, unit) : v;
}

/**
 * `withTime`: date drafts hold yyyy-mm-ddThh:mm instead of yyyy-mm-dd, read in `tz` when given
 * (pass the user's zone wherever the form is also rendered on the server, so both agree).
 */
export function parseDraft(kind: ContinuousKind, d: QuantileDraft, unit: DurationUnit = "minutes", withTime = false, tz?: string) {
  const low = parseOne(kind, d.low, unit, withTime, tz);
  const median = parseOne(kind, d.median, unit, withTime, tz);
  const high = parseOne(kind, d.high, unit, withTime, tz);
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

export function toDraft(kind: ContinuousKind, q: Quantiles, unit: DurationUnit = "minutes", tz?: string, withTime = false): QuantileDraft {
  const one = (v: number) =>
    kind === "date" ? (withTime ? toDateTimeLocal(v, tz) : toDateInput(v, tz)) : kind === "duration" ? trimNum(fromMinutes(v, unit)) : trimNum(v);
  return { low: one(q.low), median: one(q.median), high: one(q.high) };
}
