import { MINUTES_PER, type DurationUnit } from "./constants";

export const pct = (p: number, digits = 0) => (Number.isFinite(p) ? `${(p * 100).toFixed(digits)}%` : "–");

const numFmt = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 3 });

export function fmtNum(x: number, compact = false): string {
  if (!Number.isFinite(x)) return "–";
  return compact && Math.abs(x) >= 10000 ? compactFmt.format(x) : numFmt.format(x);
}

export function fmtRatio(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return "–";
  if (r >= 10) return `${r.toFixed(0)}×`;
  if (r >= 0.1) return `${r.toFixed(2).replace(/0$/, "")}×`;
  return `${r.toPrecision(1)}×`;
}

/** 1 → "1st", 22 → "22nd", 13 → "13th" */
export function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** Where an outcome fell in a forecast distribution, in words. */
export function percentileText(p: number): string {
  const n = Math.round(p * 100);
  if (n < 1) return "below the 1st percentile";
  if (n > 99) return "above the 99th percentile";
  return `the ${ordinal(n)} percentile`;
}

const trim1 = (x: number) => (Math.round(x * 10) / 10).toString();

/** 45 → "45m", 90 → "1h 30m", 2880 → "2d" */
export function fmtDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "–";
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))}s`;
  if (minutes < 59.5) return `${minutes < 10 ? trim1(minutes) : Math.round(minutes)}m`;
  const totalMin = Math.round(minutes);
  if (totalMin < 24 * 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const hours = Math.round(minutes / 60);
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  if (d >= 7 || !h) return `${d >= 7 ? trim1(minutes / 1440) : d}d`;
  return `${d}d ${h}h`;
}

/** Timer display: 01:05:09 */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const two = (n: number) => n.toString().padStart(2, "0");
  return `${hh ? `${hh}:` : ""}${two(mm)}:${two(ss)}`;
}

export const toMinutes = (value: number, unit: DurationUnit) => value * MINUTES_PER[unit];
export const fromMinutes = (minutes: number, unit: DurationUnit) => minutes / MINUTES_PER[unit];

/** Pick a natural display unit for a duration. */
export function naturalDurationUnit(minutes: number): DurationUnit {
  if (minutes >= 2 * 1440) return "days";
  if (minutes >= 120) return "hours";
  return "minutes";
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type DateStyle = "day" | "dayYear" | "dateTime" | "time" | "monthDay";

const DATE_OPTS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  day: { weekday: "short", month: "short", day: "numeric" },
  monthDay: { month: "short", day: "numeric" },
  dayYear: { month: "short", day: "numeric", year: "numeric" },
  dateTime: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
};

export function fmtDate(d: Date | number, tz: string, style: DateStyle = "day"): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const opts = { ...DATE_OPTS[style], timeZone: tz };
  // Add the year when it isn't this year.
  if ((style === "day" || style === "monthDay" || style === "dateTime") && date.getFullYear() !== new Date().getFullYear()) {
    opts.year = "numeric";
  }
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export function relativeTime(d: Date | number, now = Date.now()): string {
  const diff = (typeof d === "number" ? d : d.getTime()) - now;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 864e5],
    ["month", 30 * 864e5],
    ["week", 7 * 864e5],
    ["day", 864e5],
    ["hour", 36e5],
    ["minute", 6e4],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return diff < 0 ? "just now" : "in a moment";
}

const PREFIX_UNITS = new Set(["$", "€", "£", "¥", "₹", "₩"]);

/** "$85", "85 pages", "64°F" */
export function withUnit(num: string, unit?: string | null): string {
  if (!unit) return num;
  if (PREFIX_UNITS.has(unit)) return num.startsWith("-") ? `-${unit}${num.slice(1)}` : `${unit}${num}`;
  if (unit.startsWith("°") || unit === "%") return `${num}${unit}`;
  return `${num} ${unit}`;
}

export interface ValueContext {
  type: "binary" | "numeric" | "duration" | "date";
  unit?: string | null;
}

/** Human display for a continuous value of a question. */
export function fmtValue(q: ValueContext, value: number, tz: string): string {
  switch (q.type) {
    case "duration":
      return fmtDuration(value);
    case "date":
      return fmtDate(value, tz, "monthDay");
    case "numeric":
      return withUnit(fmtNum(value), q.unit);
    default:
      return pct(value);
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
