"use client";

import { useState, useTransition } from "react";
import { BinaryNudge, ContinuousNudge } from "@/components/forecast/nudges";
import { IntervalPreview } from "@/components/forecast/interval-preview";
import { ProbabilityInput } from "@/components/forecast/probability-input";
import { IntervalSentence, QuantileInputs } from "@/components/forecast/quantile-inputs";
import { EMPTY_DRAFT, parseDraft, toDraft, type ContinuousKind, type QuantileDraft } from "@/components/forecast/quantiles";
import { KeyboardFlow } from "@/components/keyboard-flow";
import { Button, Card, ErrorText } from "@/components/ui";
import { submitForecast } from "@/lib/actions/questions";
import { DURATION_UNITS, type DurationUnit } from "@/lib/constants";
import type { Scale } from "@/lib/scoring/continuous";
import type { TrackRecord } from "@/lib/scoring/records";

export interface FormQuestion {
  id: string;
  type: "binary" | "numeric" | "duration" | "date";
  unit: string | null;
  scale: Scale;
  confidence: number;
  tags: string[];
}

export function ForecastForm({
  q,
  latest,
  track,
  tz,
  othersCount,
}: {
  q: FormQuestion;
  latest: { probability: number | null; low: number | null; median: number | null; high: number | null } | null;
  track: TrackRecord;
  tz: string;
  othersCount: number;
}) {
  const kind: ContinuousKind | null = q.type === "binary" ? null : q.type;
  const durUnit: DurationUnit = DURATION_UNITS.includes(q.unit as DurationUnit) ? (q.unit as DurationUnit) : "minutes";
  const [probability, setProbability] = useState<number | null>(latest?.probability ?? null);
  const [draft, setDraft] = useState<QuantileDraft>(() =>
    kind && latest?.low != null && latest.median != null && latest.high != null
      ? toDraft(kind, { low: latest.low, median: latest.median, high: latest.high }, durUnit, tz)
      : EMPTY_DRAFT,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const parsed = kind ? parseDraft(kind, draft, durUnit) : null;
  const unitLabel = q.type === "numeric" ? q.unit : q.type === "duration" ? durUnit : null;
  const isUpdate = latest != null;

  function submit() {
    if (pending) return;
    setError(null);
    setSaved(false);
    let input;
    if (q.type === "binary") {
      if (probability == null) return setError("Pick a probability.");
      input = { probability, note };
    } else {
      if (!parsed?.quantiles) return setError(parsed?.error ?? "Fill in the low end, best guess and high end.");
      input = { forecast: parsed.quantiles, note };
    }
    start(async () => {
      const r = await submitForecast(q.id, input);
      if (!r.ok) return setError(r.error);
      setNote("");
      setSaved(true);
    });
  }

  return (
    <Card className="p-4 sm:p-5">
      <KeyboardFlow onSubmit={submit}>
      <div className="mb-4">
        <h2 className="font-semibold text-ink">{isUpdate ? "Update your forecast" : "Your forecast"}</h2>
        {!isUpdate && othersCount > 0 && (
          <p className="text-sm text-ink-3">
            {othersCount} {othersCount === 1 ? "person has" : "people have"} forecast. You&apos;ll see their numbers after you commit.
          </p>
        )}
        {kind && (
          <p className="text-sm text-ink-3">
            Everyone on this question gives a {q.confidence * 100}% range{kind === "duration" ? ` in ${durUnit}` : ""}.
          </p>
        )}
      </div>
      <div className="space-y-4">
        {q.type === "binary" ? (
          <>
            <ProbabilityInput value={probability} onChange={setProbability} />
            <BinaryNudge p={probability} track={track} tags={q.tags} />
          </>
        ) : (
          <>
            <QuantileInputs kind={kind!} draft={draft} onDraft={setDraft} confidence={q.confidence} unit={durUnit} numericUnit={q.unit} />
            {parsed?.error && <p className="text-sm text-bad-ink">{parsed.error}</p>}
            {parsed?.quantiles && (
              <div className="space-y-2 rounded-xl bg-surface-2/60 px-3 pb-2 pt-3">
                <IntervalPreview kind={kind!} q={parsed.quantiles} confidence={q.confidence} scale={q.scale} unit={unitLabel} tz={tz} />
                <IntervalSentence kind={kind!} q={parsed.quantiles} confidence={q.confidence} unit={unitLabel} tz={tz} />
              </div>
            )}
            <ContinuousNudge
              kind={kind!}
              q={parsed?.quantiles ?? null}
              confidence={q.confidence}
              scale={q.scale}
              track={track}
              tags={q.tags}
              unit={unitLabel}
              tz={tz}
              onApply={(adj) => setDraft(toDraft(kind!, adj, durUnit))}
            />
          </>
        )}
        <textarea
          data-flow=""
          rows={1}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isUpdate ? "What changed your mind? (optional)" : "Your reasoning (optional)"}
          className="field field-sizing-content min-h-10 resize-y text-sm"
          aria-label="Reasoning"
        />
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-good-ink">Saved ✓</span>}
          <Button data-flow-end="" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : isUpdate ? "Update forecast" : "Submit forecast"}
          </Button>
        </div>
      </div>
      </KeyboardFlow>
    </Card>
  );
}
