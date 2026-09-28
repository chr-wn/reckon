"use client";

import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { fmtRatio, fmtValue, pct } from "@/lib/format";
import { recalibrate } from "@/lib/scoring/binary";
import { applyAdjustment, type Quantiles, type Scale } from "@/lib/scoring/continuous";
import {
  MIN_BINARY_FOR_NUDGE,
  MIN_CONTINUOUS_FOR_NUDGE,
  MIN_TAG_FOR_NUDGE,
  type ContinuousTrack,
  type TrackRecord,
} from "@/lib/scoring/records";
import type { ContinuousKind } from "./quantiles";

function NudgeBox({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink-2" title="Based on your resolved predictions">
      <Compass size={16} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {children}
        {action}
      </div>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs text-ink-3">
      <Compass size={14} aria-hidden /> {children}
    </p>
  );
}

export function BinaryNudge({ p, track, tags }: { p: number | null; track: TrackRecord; tags: string[] }) {
  const lines: ReactNode[] = [];
  const b = track.binary;
  if (b && b.n >= MIN_BINARY_FOR_NUDGE && p != null) {
    const r = recalibrate(p, b);
    lines.push(
      Math.abs(r - p) >= 0.03 ? (
        <p key="cal">
          Forecasts like yours at <b className="text-ink">{pct(p)}</b> have come true about <b className="text-ink">{pct(r)}</b> of the
          time.{" "}
          {p === 0.5 || Math.abs(r - p) < 0.1
            ? ""
            : (r < p) === (p > 0.5)
              ? "You tend to be more confident than your results justify."
              : "You may be underselling yourself here."}
        </p>
      ) : (
        <p key="cal">
          Your forecasts around <b className="text-ink">{pct(p)}</b> have been well calibrated. Trust it.
        </p>
      ),
    );
  }
  for (const tag of tags) {
    const t = track.binaryByTag[tag];
    if (t && t.n >= MIN_TAG_FOR_NUDGE) {
      lines.push(
        <p key={tag}>
          <b className="text-ink">#{tag}</b>: you&apos;ve averaged {pct(t.meanP)}, and it happened {Math.round(t.freq * t.n)} of {t.n}{" "}
          times ({pct(t.freq)}).
        </p>,
      );
    }
  }
  if (lines.length) return <NudgeBox>{lines}</NudgeBox>;
  const n = b?.n ?? 0;
  if (n >= MIN_BINARY_FOR_NUDGE) return null;
  return (
    <Hint>
      Resolve {Math.max(1, MIN_BINARY_FOR_NUDGE - Math.round(n))} more yes/no question{MIN_BINARY_FOR_NUDGE - n > 1 ? "s" : ""} to
      unlock personal calibration hints.
    </Hint>
  );
}

const KIND_NOUN: Record<ContinuousKind, string> = { duration: "time estimates", numeric: "number estimates", date: "date estimates" };

export function pickContinuousModel(
  kind: ContinuousKind,
  track: TrackRecord,
  tags: string[],
): { model: ContinuousTrack; source: string } | null {
  for (const tag of tags) {
    const m = track.continuousByTag[tag]?.[kind];
    if (m && m.n >= MIN_TAG_FOR_NUDGE) return { model: m, source: `#${tag}` };
  }
  const m = track.continuous[kind];
  return m && m.n >= MIN_CONTINUOUS_FOR_NUDGE ? { model: m, source: KIND_NOUN[kind] } : null;
}

export function ContinuousNudge({
  kind,
  q,
  confidence,
  scale,
  track,
  tags,
  unit,
  tz,
  onApply,
}: {
  kind: ContinuousKind;
  q: Quantiles | null;
  confidence: number;
  scale: Scale;
  track: TrackRecord;
  tags: string[];
  unit?: string | null;
  tz: string;
  onApply: (q: Quantiles) => void;
}) {
  const picked = pickContinuousModel(kind, track, tags);
  if (!picked) {
    const n = Math.round(track.continuous[kind]?.n ?? 0);
    return (
      <Hint>
        Resolve {Math.max(1, MIN_CONTINUOUS_FOR_NUDGE - n)} more {KIND_NOUN[kind].replace(" estimates", "")} question
        {MIN_CONTINUOUS_FOR_NUDGE - n > 1 ? "s" : ""} to get suggestions adjusted for your track record.
      </Hint>
    );
  }
  const { model, source } = picked;
  const suggestion = q ? applyAdjustment(q, confidence, scale, model) : null;
  const v = (x: number) => fmtValue({ type: kind, unit }, x, tz);
  return (
    <NudgeBox
      action={
        suggestion && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>
              Adjusted for your record:{" "}
              <b className="text-ink">
                {v(suggestion.low)} – {v(suggestion.high)}
              </b>
              , best guess <b className="text-ink">{v(suggestion.median)}</b>
            </span>
            <Button size="xs" variant="secondary" onClick={() => onApply(suggestion)}>
              Use this
            </Button>
          </div>
        )
      }
    >
      <p>
        Your {source} have landed inside the stated interval <b className="text-ink">{pct(model.hitRate)}</b> of the time (aiming
        for {pct(model.targetRate)}).
        {kind === "duration" && model.multiplier != null && (
          <>
            {" "}
            Things took <b className="text-ink">{fmtRatio(model.multiplier)}</b> your best guess on average.
          </>
        )}
        {kind !== "duration" && (
          <>
            {" "}
            Reality came in above your best guess <b className="text-ink">{pct(model.aboveMedian)}</b> of the time.
          </>
        )}
      </p>
      {!q && <p className="text-ink-3">Enter your own estimate first — then compare it to what your history suggests.</p>}
    </NudgeBox>
  );
}
