"use client";

import { cn } from "@/components/ui";
import { CONFIDENCE_LEVELS, DURATION_UNITS, type DurationUnit } from "@/lib/constants";
import { fmtValue, pct } from "@/lib/format";
import type { Quantiles } from "@/lib/scoring/continuous";
import type { ContinuousKind, QuantileDraft } from "./quantiles";

const TAIL_WORDS: Record<ContinuousKind, [string, string]> = {
  duration: ["takes less", "takes longer"],
  date: ["happens earlier", "happens later"],
  numeric: ["is lower", "is higher"],
};

/**
 * Low / best guess / high. Each bound is framed as its own tail question
 * ("10% chance it takes less than…"): judging each tail separately produces
 * wider, better-calibrated intervals than asking for a range in one go.
 */
export function QuantileInputs({
  kind,
  draft,
  onDraft,
  confidence,
  unit,
  numericUnit,
}: {
  kind: ContinuousKind;
  draft: QuantileDraft;
  onDraft: (d: QuantileDraft) => void;
  confidence: number;
  /** duration display unit */
  unit?: DurationUnit;
  /** numeric unit label */
  numericUnit?: string | null;
}) {
  const tail = pct((1 - confidence) / 2, confidence === 0.95 ? 1 : 0);
  const [lessWord, moreWord] = TAIL_WORDS[kind];
  const suffix = kind === "duration" ? unit : kind === "numeric" ? numericUnit : null;
  const field = (key: keyof QuantileDraft, label: React.ReactNode, sub: string) => (
    <label className="block min-w-0">
      <span className="block text-[0.8125rem] font-medium text-ink-2">{label}</span>
      <span className="mb-1.5 block text-xs text-ink-3">{sub}</span>
      <div className="relative">
        <input
          type={kind === "date" ? "date" : "text"}
          data-flow=""
          data-quantile={key}
          inputMode={kind === "date" ? undefined : "decimal"}
          autoComplete="off"
          value={draft[key]}
          onChange={(e) => onDraft({ ...draft, [key]: e.target.value })}
          className={cn("field tnum", key === "median" && "font-semibold", suffix && "pr-14")}
          aria-label={typeof label === "string" ? label : key}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 max-w-12 -translate-y-1/2 truncate text-xs text-ink-3">
            {kind === "duration" ? suffix.slice(0, 3) : suffix}
          </span>
        )}
      </div>
    </label>
  );
  return (
    <div className={cn("grid gap-3", kind === "date" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-3")}>
      {field("low", "Low end", `${tail} chance it ${lessWord}`)}
      {field("median", "Best guess", "50/50 either side")}
      {field("high", "High end", `${tail} chance it ${moreWord}`)}
    </div>
  );
}

export function ConfidencePicker({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line-strong p-0.5" role="radiogroup" aria-label="Interval confidence">
      {CONFIDENCE_LEVELS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={cn(
            "rounded-md px-2.5 py-1 text-sm font-medium tnum transition-colors",
            value === c ? "bg-ink text-surface" : "text-ink-2 hover:text-ink",
          )}
        >
          {c * 100}%
        </button>
      ))}
    </div>
  );
}

export function DurationUnitSelect({ value, onChange }: { value: DurationUnit; onChange: (u: DurationUnit) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as DurationUnit)} className="field w-auto py-1 text-sm" aria-label="Unit">
      {DURATION_UNITS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}

/** One-sentence read-back of what the forecast says. */
export function IntervalSentence({
  kind,
  q,
  confidence,
  unit,
  tz,
}: {
  kind: ContinuousKind;
  q: Quantiles;
  confidence: number;
  unit?: string | null;
  tz: string;
}) {
  const v = (x: number) => fmtValue({ type: kind, unit }, x, tz);
  const verb = kind === "duration" ? "it'll take" : kind === "date" ? "it'll happen" : "it'll be";
  return (
    <p className="text-sm text-ink-2">
      You&apos;re <strong className="font-semibold text-ink">{confidence * 100}% sure</strong> {verb} between{" "}
      <strong className="font-semibold text-ink">{v(q.low)}</strong> and <strong className="font-semibold text-ink">{v(q.high)}</strong>
      {kind === "date" ? ", most likely around " : ", most likely about "}
      <strong className="font-semibold text-ink">{v(q.median)}</strong>.
    </p>
  );
}
