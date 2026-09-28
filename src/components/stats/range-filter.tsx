import Link from "next/link";
import { cn } from "@/components/ui";

export const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export function parseRange(v: unknown): (typeof RANGES)[number] {
  return RANGES.find((r) => r.key === v) ?? RANGES[3];
}

/** One filter row above everything it scopes. */
export function RangeFilter({ base, active }: { base: string; active: RangeKey }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-1">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={r.key === "all" ? base : `${base}?range=${r.key}`}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            active === r.key ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
