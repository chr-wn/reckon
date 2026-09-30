import { casual } from "chrono-node";

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0, 0);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 0, 0);

/**
 * Finds a deadline in question text ("…by Friday?", "…tonight", "…by Oct 3 at 5pm").
 * Vague times become end-of-day; "end of <month>" becomes the month's last day.
 */
export function parseDeadline(text: string, ref = new Date()): { date: Date; matched: string } | null {
  const results = casual.parse(text, ref, { forwardDate: true });
  const r = results[results.length - 1];
  if (!r) return null;
  const start = r.start;
  let date = start.date();
  // "by October" / "end of October" → the month's last day; "by Friday" → end of Friday.
  if (!start.isCertain("day") && start.isCertain("month")) date = endOfMonth(date);
  else if (!start.isCertain("hour")) date = endOfDay(date);
  if (date.getTime() <= ref.getTime()) return null;
  return { date, matched: r.text };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Value for <input type="datetime-local"> in local time. */
export function toDateTimeInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeInput(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Quick-pick deadlines relative to now. */
export function deadlinePresets(now = new Date()): { label: string; date: Date }[] {
  const day = (offset: number) => endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  const friday = (5 - now.getDay() + 7) % 7 || 7;
  return [
    { label: "Tonight", date: day(0) },
    { label: "Tomorrow", date: day(1) },
    { label: "Friday", date: day(friday) },
    { label: "1 week", date: day(7) },
    { label: "1 month", date: day(30) },
  ];
}
