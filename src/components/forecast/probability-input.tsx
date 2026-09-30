"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/components/ui";

const WORDS: [number, string][] = [
  [0.05, "almost certainly not"],
  [0.2, "very unlikely"],
  [0.4, "unlikely"],
  [0.6, "toss-up"],
  [0.8, "likely"],
  [0.95, "very likely"],
  [1, "almost certain"],
];

export const probabilityWords = (p: number) => WORDS.find(([max]) => p < max)?.[1] ?? "almost certain";

/** Slider + number box for a 1–99% probability. `value` null means "not chosen yet". */
export function ProbabilityInput({
  value,
  onChange,
  id = "probability",
  compact = false,
  label = "Probability",
}: {
  value: number | null;
  onChange: (p: number | null) => void;
  id?: string;
  compact?: boolean;
  /** accessible name of the slider and box (it's also the "how sure?" control for ranges) */
  label?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(Math.round(value * 1000) / 10));
  const pctVal = value == null ? 50 : Math.round(value * 100);

  function fromText(t: string) {
    setText(t);
    const v = Number(t.replace(/[%\s]/g, ""));
    onChange(t.trim() !== "" && Number.isFinite(v) && v >= 1 && v <= 99 ? v / 100 : null);
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={99}
          step={1}
          value={pctVal}
          aria-label={label}
          aria-valuetext={value == null ? "not set" : `${pctVal}%`}
          onChange={(e) => {
            const v = Number(e.target.value);
            setText(String(v));
            onChange(v / 100);
          }}
          data-flow-from=""
          className={cn("range flex-1", value == null && "opacity-50")}
          style={{ "--fill": `${pctVal}%` } as CSSProperties}
        />
        <div className="relative w-[5.5rem] shrink-0">
          <input
            id={id}
            aria-label={label}
            data-flow=""
            inputMode="decimal"
            autoComplete="off"
            placeholder="–"
            value={text}
            onChange={(e) => fromText(e.target.value)}
            onKeyDown={(e) => {
              // ↑/↓ nudge by 1 point, with Shift by 5
              if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
              e.preventDefault();
              const step = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 5 : 1);
              fromText(String(Math.min(99, Math.max(1, Math.round(value == null ? 50 : value * 100) + step))));
            }}
            aria-keyshortcuts="ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown"
            className="field pr-7 text-right text-lg font-semibold tnum"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">%</span>
        </div>
      </div>
      {!compact && (
        <p className="mt-1.5 min-h-5 text-sm text-ink-3">
          {value == null ? (
            "Drag or type a probability between 1% and 99%."
          ) : (
            <>
              <span className="font-medium text-ink-2">{probabilityWords(value)}</span> · of 10 forecasts like this, about{" "}
              {Math.round(value * 10)} should come true
            </>
          )}
        </p>
      )}
    </div>
  );
}
