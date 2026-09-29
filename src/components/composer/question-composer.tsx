"use client";

import { Check, Play, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BinaryNudge, ContinuousNudge } from "@/components/forecast/nudges";
import { IntervalPreview } from "@/components/forecast/interval-preview";
import { ProbabilityInput } from "@/components/forecast/probability-input";
import { ConfidencePicker, DurationUnitSelect, IntervalSentence, QuantileInputs } from "@/components/forecast/quantile-inputs";
import { EMPTY_DRAFT, parseDraft, toDraft, type QuantileDraft } from "@/components/forecast/quantiles";
import { KeyboardFlow } from "@/components/keyboard-flow";
import { Button, Card, cn, ErrorText, Label } from "@/components/ui";
import { VisibilityToggle, type Visibility } from "@/components/visibility-toggle";
import { createQuestion } from "@/lib/actions/questions";
import { DEFAULT_CONFIDENCE, TYPE_LABELS, type DurationUnit } from "@/lib/constants";
import { fmtDate, relativeTime } from "@/lib/format";
import { detectType, PLACEHOLDERS } from "@/lib/ideas";
import { deadlinePresets, fromDateTimeInput, parseDeadline, toDateTimeInput } from "@/lib/parse-date";
import type { Scale } from "@/lib/scoring/continuous";
import type { QType, TrackRecord } from "@/lib/scoring/records";
import { useHydrated } from "@/lib/use-hydrated";
import type { CreateQuestionInput } from "@/lib/validation";

export interface ComposerProps {
  track: TrackRecord;
  tz: string;
  /** chosen on the server so SSR and hydration agree */
  placeholderIndex?: number;
}

export function QuestionComposer(props: ComposerProps) {
  const [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);
  return (
    <div className="space-y-3">
      {saved && (
        <div className="flex items-center gap-3 rounded-xl border border-good/30 bg-good-soft px-4 py-2.5 text-sm text-good-ink">
          <Check size={16} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            Posted: <span className="font-medium">{saved.title}</span>
          </span>
          <Link href={`/q/${saved.id}`} className="shrink-0 font-medium underline underline-offset-2">
            View
          </Link>
          <button onClick={() => setSaved(null)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}
      <ComposerBody
        key={formKey}
        {...props}
        // After posting, land back in an empty box ready for the next one.
        autoFocus={formKey > 0}
        onCreated={(id, title) => {
          setSaved({ id, title });
          setFormKey((k) => k + 1);
        }}
      />
    </div>
  );
}

const TYPES: QType[] = ["binary", "duration", "numeric", "date"];

function defaultDeadline(type: QType): Date | null {
  if (type !== "binary") return null;
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 23, 59);
}

/** A printable keystroke that isn't aimed at some other editable element. */
function isStrayTyping(e: KeyboardEvent) {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return false;
  if (e.key.length !== 1 || e.key === " ") return false; // space still scrolls the page
  const t = e.target as HTMLElement | null;
  return !(t && (t.isContentEditable || t.closest("input, textarea, select, [contenteditable]")));
}

function ComposerBody({
  track,
  tz,
  placeholderIndex = 0,
  autoFocus,
  onCreated,
}: ComposerProps & { autoFocus: boolean; onCreated: (id: string, title: string) => void }) {
  const router = useRouter();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [pickedType, setPickedType] = useState<QType | null>(null);
  const [probability, setProbability] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuantileDraft>(EMPTY_DRAFT);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [durUnit, setDurUnit] = useState<DurationUnit>("minutes");
  const [numUnit, setNumUnit] = useState("");
  const [logScale, setLogScale] = useState(false);
  const [closesInput, setClosesInput] = useState<string | null>(null); // null = not touched
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [notes, setNotes] = useState("");
  const [startTimer, setStartTimer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const placeholder = PLACEHOLDERS[placeholderIndex % PLACEHOLDERS.length];

  // Start typing anywhere on the page and it lands in the question box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = titleRef.current;
      if (!el || !isStrayTyping(e)) return;
      el.focus(); // the keystroke's character is inserted into the newly focused box
      el.setSelectionRange(el.value.length, el.value.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const type: QType = pickedType ?? detectType(title) ?? "binary";
  const expanded = title.trim().length > 0;
  const kind = type === "binary" ? null : type;
  const scale: Scale = type === "duration" ? "log" : type === "numeric" && logScale ? "log" : "linear";

  // Deadlines depend on the browser's clock and time zone, so they're computed after hydration.
  const parsedDeadline = useMemo(() => (!hydrated || type === "duration" ? null : parseDeadline(title)), [title, type, hydrated]);
  const autoDeadline = hydrated ? (parsedDeadline?.date ?? defaultDeadline(type)) : null;
  const closesValue = closesInput ?? (autoDeadline ? toDateTimeInput(autoDeadline) : "");
  const closesDate = fromDateTimeInput(closesValue);

  const parsed = kind ? parseDraft(kind, draft, durUnit) : null;
  const quantiles = parsed?.quantiles ?? null;
  const unitLabel = type === "numeric" ? numUnit : type === "duration" ? durUnit : null;

  function submit() {
    if (pending) return;
    setError(null);
    if (title.trim().length < 3) return setError("Write a question first.");
    const closesAt = closesDate ? closesDate.getTime() : null;
    const common = { title, details: notes, visibility, closesAt };
    let input: CreateQuestionInput;
    if (type === "binary") {
      if (probability == null) return setError("Pick a probability.");
      input = { ...common, type, probability };
    } else {
      if (!quantiles) return setError(parsed?.error ?? "Fill in the low end, best guess and high end.");
      const cont = { ...common, confidence, forecast: quantiles };
      input =
        type === "duration"
          ? { ...cont, type, unit: durUnit, startTimer }
          : type === "numeric"
            ? { ...cont, type, unit: numUnit, scale: logScale ? "log" : "linear" }
            : { ...cont, type };
    }
    startTransition(async () => {
      const res = await createQuestion(input);
      if (!res.ok) return setError(res.error);
      if (type === "duration" && startTimer) router.push(`/q/${res.data.id}`);
      else onCreated(res.data.id, title.trim());
    });
  }

  return (
    <Card className={cn("p-4 sm:p-5", !expanded && "py-3 sm:py-3.5")}>
      <KeyboardFlow onSubmit={submit}>
        <label htmlFor="q-title" className="sr-only">
          Question
        </label>
        <textarea
          id="q-title"
          ref={titleRef}
          data-flow=""
          rows={1}
          autoFocus={autoFocus}
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          placeholder={`Predict something… e.g. “${placeholder}”`}
          className="field-sizing-content block max-h-40 w-full resize-none bg-transparent text-[1.125rem] font-medium leading-snug text-ink outline-none placeholder:font-normal placeholder:text-ink-3 focus-visible:outline-none"
        />

        {expanded && (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Question type">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={type === t}
                    onClick={() => setPickedType(t)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-sm font-medium transition-colors sm:px-3",
                      type === t ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2",
                    )}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              {!pickedType && detectType(title) && <span className="text-xs text-ink-3">detected from wording</span>}
            </div>

            {type === "binary" ? (
              <div className="space-y-3">
                <ProbabilityInput value={probability} onChange={setProbability} />
                <BinaryNudge p={probability} track={track} tags={[]} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm font-medium text-ink-2">How sure?</span>
                  <ConfidencePicker value={confidence} onChange={setConfidence} />
                  {type === "duration" && <DurationUnitSelect value={durUnit} onChange={setDurUnit} />}
                  {type === "numeric" && (
                    <>
                      <input
                        value={numUnit}
                        onChange={(e) => setNumUnit(e.target.value.slice(0, 30))}
                        placeholder="unit (optional)"
                        aria-label="Unit"
                        className="field w-32 py-1 text-sm"
                      />
                      <label
                        className="flex items-center gap-1.5 text-xs text-ink-3"
                        title="For quantities that vary by multiples (money, counts): being off by 2× counts the same at 10 or 10,000."
                      >
                        <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} className="accent-[var(--accent)]" />
                        judge as ratios
                      </label>
                    </>
                  )}
                </div>
                <QuantileInputs kind={kind!} draft={draft} onDraft={setDraft} confidence={confidence} unit={durUnit} numericUnit={numUnit} />
                {parsed?.error && <p className="text-sm text-bad-ink">{parsed.error}</p>}
                {quantiles && (
                  <div className="space-y-2 rounded-xl bg-surface-2/60 px-3 pb-2 pt-3">
                    <IntervalPreview kind={kind!} q={quantiles} confidence={confidence} scale={scale} unit={unitLabel} tz={tz} />
                    <IntervalSentence kind={kind!} q={quantiles} confidence={confidence} unit={unitLabel} tz={tz} />
                  </div>
                )}
                <ContinuousNudge
                  kind={kind!}
                  q={quantiles}
                  confidence={confidence}
                  scale={scale}
                  track={track}
                  tags={[]}
                  unit={unitLabel}
                  tz={tz}
                  onApply={(q) => setDraft(toDraft(kind!, q, durUnit))}
                />
              </div>
            )}

            <div>
              <Label htmlFor="q-closes">
                {type === "duration" ? "Plan to finish by" : "Resolve by"} <span className="font-normal text-ink-3">(optional)</span>
              </Label>
              <div className="flex max-w-sm gap-2">
                <input
                  id="q-closes"
                  data-flow=""
                  type="datetime-local"
                  value={closesValue}
                  onChange={(e) => setClosesInput(e.target.value)}
                  className="field tnum"
                />
                {closesValue && (
                  <Button variant="ghost" size="md" className="px-2.5" onClick={() => setClosesInput("")} aria-label="No deadline">
                    <X size={16} />
                  </Button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {hydrated &&
                  deadlinePresets().map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setClosesInput(toDateTimeInput(p.date))}
                      className="rounded-md px-1.5 py-0.5 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                    >
                      {p.label}
                    </button>
                  ))}
              </div>
              {closesInput == null && parsedDeadline && (
                <p className="mt-1 text-xs text-ink-3">
                  From “{parsedDeadline.matched}” · {fmtDate(parsedDeadline.date, tz, "dateTime")} ({relativeTime(parsedDeadline.date)})
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="q-notes">
                Notes <span className="font-normal text-ink-3">(optional · visible to anyone who can see the prediction)</span>
              </Label>
              <textarea
                id="q-notes"
                data-flow=""
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything: what exactly counts as yes, why you picked this number, context for friends…"
                className="field field-sizing-content min-h-16 resize-y"
              />
            </div>

            <ErrorText>{error}</ErrorText>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <VisibilityToggle value={visibility} onChange={setVisibility} />
              {type === "duration" && (
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" checked={startTimer} onChange={(e) => setStartTimer(e.target.checked)} className="accent-[var(--accent)]" />
                  <Play size={14} /> Start timer now
                </label>
              )}
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden text-xs text-ink-3 sm:inline">
                  <kbd className="font-sans">↵</kbd> next · <kbd className="font-sans">⌘↵</kbd> post
                </span>
                <Button data-flow-end="" onClick={submit} disabled={pending}>
                  {pending ? "Posting…" : "Post"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </KeyboardFlow>
    </Card>
  );
}
