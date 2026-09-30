"use client";

import { Keyboard, Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BinaryNudge, ContinuousNudge } from "@/components/forecast/nudges";
import { IntervalPreview } from "@/components/forecast/interval-preview";
import { ProbabilityInput } from "@/components/forecast/probability-input";
import { ConfidencePicker, DurationUnitSelect, IntervalSentence, QuantileInputs } from "@/components/forecast/quantile-inputs";
import { EMPTY_DRAFT, parseDraft, toDraft, type QuantileDraft } from "@/components/forecast/quantiles";
import { KeyboardFlow } from "@/components/keyboard-flow";
import { Button, Card, cn, ErrorText, Label } from "@/components/ui";
import { VisibilityToggle, type Visibility } from "@/components/visibility-toggle";
import type { ActionResult } from "@/lib/actions/questions";
import { CONFIDENCE_LEVELS, DEFAULT_CONFIDENCE, DURATION_UNITS, TYPE_LABELS, type DurationUnit } from "@/lib/constants";
import { fmtDate, relativeTime } from "@/lib/format";
import { detectType } from "@/lib/ideas";
import { deadlinePresets, fromDateTimeInput, parseDeadline, toDateTimeInput } from "@/lib/parse-date";
import type { Scale } from "@/lib/scoring/continuous";
import type { QType, TrackRecord } from "@/lib/scoring/records";
import { runAltShortcut, type Shortcut } from "@/lib/shortcuts";
import { useHydrated } from "@/lib/use-hydrated";
import type { CreateQuestionInput } from "@/lib/validation";

type FocusTarget = "title" | "forecast" | "deadline" | "notes";

/** Starting values, e.g. from a Google Calendar event in the Chrome extension. */
export interface ComposerInitial {
  title?: string;
  details?: string;
  /** epoch ms */
  closesAt?: number | null;
  focus?: FocusTarget;
}

export interface ComposerFormProps {
  track: TrackRecord;
  tz: string;
  placeholder: string;
  initial?: ComposerInitial;
  /** Start typing anywhere on the page and it lands in the question box. */
  captureStrayTyping?: boolean;
  submit: (input: CreateQuestionInput) => Promise<ActionResult<{ id: string }>>;
  onCreated: (created: { id: string; title: string; input: CreateQuestionInput }) => void;
  onEscape?: () => void;
  className?: string;
}

const TYPES: QType[] = ["binary", "duration", "numeric", "date"];

/** ⌥ + key picks the type; on an empty box it also types the opening words. */
const TYPE_KEYS: Record<QType, { code: string; label: string; starter: string }> = {
  binary: { code: "KeyY", label: "⌥Y", starter: "Will I " },
  duration: { code: "KeyL", label: "⌥L", starter: "How long will " },
  numeric: { code: "KeyM", label: "⌥M", starter: "How many " },
  date: { code: "KeyW", label: "⌥W", starter: "When will " },
};

const PRESET_LABELS = ["Tonight", "Tomorrow", "Friday", "1 week", "1 month"];

const FOCUS_SELECTORS: Record<FocusTarget, string> = {
  title: "#q-title",
  forecast: "#q-probability, [data-quantile='low']",
  deadline: "#q-closes",
  notes: "#q-notes",
};

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

const next = <T,>(list: readonly T[], current: T) => list[(list.indexOf(current) + 1) % list.length];

/**
 * The whole "post a prediction" form, keyboard-first. Framework-free (no Next.js
 * imports) so the Chrome extension renders the same component; the caller
 * decides how a question is actually created.
 */
export function ComposerForm({ track, tz, placeholder, initial, captureStrayTyping, submit, onCreated, onEscape, className }: ComposerFormProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [pickedType, setPickedType] = useState<QType | null>(null);
  const [probability, setProbability] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuantileDraft>(EMPTY_DRAFT);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [durUnit, setDurUnit] = useState<DurationUnit>("minutes");
  const [numUnit, setNumUnit] = useState("");
  const [logScale, setLogScale] = useState(false);
  // null = not touched (use the deadline parsed from the question)
  const [closesInput, setClosesInput] = useState<string | null>(initial?.closesAt != null ? toDateTimeInput(new Date(initial.closesAt)) : null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [notes, setNotes] = useState(initial?.details ?? "");
  const [startTimer, setStartTimer] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget } | null>(initial?.focus ? { target: initial.focus } : null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!captureStrayTyping) return;
    const onKey = (e: KeyboardEvent) => {
      const el = titleRef.current;
      if (!el || !isStrayTyping(e)) return;
      el.focus(); // the keystroke's character is inserted into the newly focused box
      el.setSelectionRange(el.value.length, el.value.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captureStrayTyping]);

  // Focus moves happen after the render that creates the target field.
  useEffect(() => {
    if (!focusRequest) return;
    const el = rootRef.current?.querySelector<HTMLElement>(FOCUS_SELECTORS[focusRequest.target]);
    if (!el) return;
    el.focus();
    if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === "text")) {
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [focusRequest]);
  const requestFocus = (target: FocusTarget) => setFocusRequest({ target });

  // Inside the extension's overlay (a cross-origin iframe) Chrome ignores focus() until the page
  // hands focus to the frame; when that happens, put the cursor where it was meant to go.
  const initialFocus = initial?.focus;
  useEffect(() => {
    if (!initialFocus) return;
    const onWindowFocus = () => {
      if (!rootRef.current?.contains(document.activeElement)) setFocusRequest({ target: initialFocus });
    };
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [initialFocus]);

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

  function chooseType(t: QType) {
    if (!title.trim()) {
      setTitle(TYPE_KEYS[t].starter);
      setPickedType(t);
      requestFocus("title");
      return;
    }
    setPickedType(t);
    requestFocus("forecast");
  }

  const shortcuts: Shortcut[] = [
    ...TYPES.map((t) => ({ code: TYPE_KEYS[t].code, label: TYPE_KEYS[t].label, description: TYPE_LABELS[t], run: () => chooseType(t) })),
    ...PRESET_LABELS.map((label, i) => ({
      code: `Digit${i + 1}`,
      label: `⌥${i + 1}`,
      description: `Deadline: ${label.toLowerCase()}`,
      run: () => setClosesInput(toDateTimeInput(deadlinePresets()[i].date)),
    })),
    { code: "Digit0", label: "⌥0", description: "No deadline", run: () => setClosesInput("") },
    { code: "KeyD", label: "⌥D", description: "Edit the deadline", run: () => requestFocus("deadline") },
    { code: "KeyP", label: "⌥P", description: "Public / only me", run: () => setVisibility((v) => (v === "public" ? "private" : "public")) },
    { code: "KeyO", label: "⌥O", description: "Notes", run: () => requestFocus("notes") },
    ...(kind
      ? [{ code: "KeyC", label: "⌥C", description: "Range confidence (50/80/90/95%)", run: () => setConfidence((c) => next(CONFIDENCE_LEVELS, c as (typeof CONFIDENCE_LEVELS)[number])) }]
      : []),
    ...(type === "duration"
      ? [
          { code: "KeyH", label: "⌥H", description: "Minutes / hours / days", run: () => setDurUnit((u) => next(DURATION_UNITS, u)) },
          { code: "KeyT", label: "⌥T", description: "Start the timer when posting", run: () => setStartTimer((s) => !s) },
        ]
      : []),
    ...(type === "numeric" ? [{ code: "KeyR", label: "⌥R", description: "Judge as ratios", run: () => setLogScale((s) => !s) }] : []),
    { code: "Slash", label: "⌥/", description: "Show / hide shortcuts", run: () => setShowKeys((s) => !s) },
  ];

  function doSubmit() {
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
      const res = await submit(input);
      if (!res.ok) return setError(res.error);
      onCreated({ id: res.data.id, title: title.trim(), input });
    });
  }

  return (
    <Card ref={rootRef} className={cn("p-4 sm:p-5", !expanded && "py-3 sm:py-3.5", className)}>
      <KeyboardFlow
        onSubmit={doSubmit}
        onKeyDown={(e) => {
          if (e.key === "Escape" && onEscape) {
            e.preventDefault();
            onEscape();
            return;
          }
          runAltShortcut(e, shortcuts);
        }}
      >
        <label htmlFor="q-title" className="sr-only">
          Question
        </label>
        <textarea
          id="q-title"
          ref={titleRef}
          data-flow=""
          rows={1}
          autoFocus={initial?.focus === "title"}
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
                    aria-keyshortcuts={`Alt+${TYPE_KEYS[t].code.slice(3)}`}
                    title={`${TYPE_LABELS[t]} (${TYPE_KEYS[t].label})`}
                    onClick={() => setPickedType(t)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-sm font-medium transition-colors sm:px-3",
                      type === t ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2",
                    )}
                  >
                    {TYPE_LABELS[t]}
                    <kbd className="ml-1.5 hidden font-sans text-[0.6875rem] font-normal text-ink-3 sm:inline">{TYPE_KEYS[t].label}</kbd>
                  </button>
                ))}
              </div>
              {!pickedType && detectType(title) && <span className="text-xs text-ink-3">detected from wording</span>}
            </div>

            {type === "binary" ? (
              <div className="space-y-3">
                <ProbabilityInput id="q-probability" value={probability} onChange={setProbability} />
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
                        title="For quantities that vary by multiples (money, counts): being off by 2× counts the same at 10 or 10,000. (⌥R)"
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
                {type === "duration" ? "Plan to finish by" : "Resolve by"} <span className="font-normal text-ink-3">(optional · ⌥D)</span>
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
                  <Button variant="ghost" size="md" className="px-2.5" onClick={() => setClosesInput("")} aria-label="No deadline" title="No deadline (⌥0)">
                    <X size={16} />
                  </Button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {hydrated &&
                  deadlinePresets().map((p, i) => (
                    <button
                      key={p.label}
                      type="button"
                      title={`⌥${i + 1}`}
                      aria-keyshortcuts={`Alt+${i + 1}`}
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
                Notes <span className="font-normal text-ink-3">(optional · visible to anyone who can see the prediction · ⌥O)</span>
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
              <div title="⌥P">
                <VisibilityToggle value={visibility} onChange={setVisibility} />
              </div>
              {type === "duration" && (
                <label className="flex items-center gap-2 text-sm text-ink-2" title="⌥T">
                  <input type="checkbox" checked={startTimer} onChange={(e) => setStartTimer(e.target.checked)} className="accent-[var(--accent)]" />
                  <Play size={14} /> Start timer now
                </label>
              )}
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowKeys((s) => !s)}
                  aria-expanded={showKeys}
                  className="hidden items-center gap-1.5 text-xs text-ink-3 hover:text-ink-2 sm:inline-flex"
                >
                  <Keyboard size={14} aria-hidden />
                  <kbd className="font-sans">↵</kbd> next · <kbd className="font-sans">⌘↵</kbd> post · <kbd className="font-sans">⌥/</kbd> more
                </button>
                <Button data-flow-end="" onClick={doSubmit} disabled={pending}>
                  {pending ? "Posting…" : "Post"}
                </Button>
              </div>
            </div>

            {showKeys && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-surface-2/60 px-3 py-2.5 text-xs sm:grid-cols-[auto_1fr_auto_1fr]">
                {[
                  { label: "↵", description: "Next field" },
                  { label: "⌘↵", description: "Post" },
                  ...(type === "binary" ? [{ label: "↑ ↓", description: "Probability ±1 (⇧ ±5)" }] : []),
                  ...(onEscape ? [{ label: "Esc", description: "Close" }] : []),
                  ...shortcuts,
                ].map((s) => (
                  <div key={s.label} className="contents">
                    <dt>
                      <kbd className="font-sans font-medium text-ink-2">{s.label}</kbd>
                    </dt>
                    <dd className="text-ink-3">{s.description}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </KeyboardFlow>
    </Card>
  );
}
