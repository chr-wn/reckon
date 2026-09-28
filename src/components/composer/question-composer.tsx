"use client";

import { Check, ChevronDown, Play, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BinaryNudge, ContinuousNudge } from "@/components/forecast/nudges";
import { IntervalPreview } from "@/components/forecast/interval-preview";
import { ProbabilityInput } from "@/components/forecast/probability-input";
import { ConfidencePicker, DurationUnitSelect, IntervalSentence, QuantileInputs } from "@/components/forecast/quantile-inputs";
import { EMPTY_DRAFT, parseDraft, toDraft, type QuantileDraft } from "@/components/forecast/quantiles";
import { GroupPicker } from "@/components/group-picker";
import { TagInput } from "@/components/tag-input";
import { Button, Card, cn, ErrorText, Label } from "@/components/ui";
import { createQuestion } from "@/lib/actions/questions";
import { DEFAULT_CONFIDENCE, TYPE_LABELS, type DurationUnit } from "@/lib/constants";
import { fmtDate, relativeTime } from "@/lib/format";
import { detectType, PLACEHOLDERS } from "@/lib/ideas";
import { useHydrated } from "@/lib/use-hydrated";
import { deadlinePresets, fromDateTimeInput, parseDeadline, toDateTimeInput } from "@/lib/parse-date";
import type { Scale } from "@/lib/scoring/continuous";
import type { QType, TrackRecord } from "@/lib/scoring/records";
import type { CreateQuestionInput } from "@/lib/validation";

export interface ComposerProps {
  groups: { id: string; name: string }[];
  defaultGroupIds: string[];
  tags: string[];
  track: TrackRecord;
  tz: string;
  mode: "quick" | "full";
  initial?: { title?: string; type?: QType };
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
            Logged: <span className="font-medium">{saved.title}</span>
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

function ComposerBody({
  groups,
  defaultGroupIds,
  tags: tagSuggestions,
  track,
  tz,
  mode,
  initial,
  placeholderIndex = 0,
  onCreated,
}: ComposerProps & { onCreated: (id: string, title: string) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [pickedType, setPickedType] = useState<QType | null>(initial?.type ?? null);
  const [probability, setProbability] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuantileDraft>(EMPTY_DRAFT);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [durUnit, setDurUnit] = useState<DurationUnit>("minutes");
  const [numUnit, setNumUnit] = useState("");
  const [logScale, setLogScale] = useState(false);
  const [closesInput, setClosesInput] = useState<string | null>(null); // null = not touched
  const [tags, setTags] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>(defaultGroupIds);
  const [details, setDetails] = useState("");
  const [note, setNote] = useState("");
  const [startTimer, setStartTimer] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const placeholder = PLACEHOLDERS[placeholderIndex % PLACEHOLDERS.length];

  const type: QType = pickedType ?? detectType(title) ?? "binary";
  const expanded = mode === "full" || title.trim().length > 0;
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
    setError(null);
    if (title.trim().length < 3) return setError("Write a question first.");
    const closesAt = closesDate ? closesDate.getTime() : null;
    const common = { title, details, tags, groupIds, closesAt, note };
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
      if (mode === "full" || (type === "duration" && startTimer)) router.push(`/q/${res.data.id}`);
      else onCreated(res.data.id, title.trim());
    });
  }

  return (
    <Card className={cn("p-4 sm:p-5", mode === "quick" && !expanded && "py-3 sm:py-3.5")}>
      <label htmlFor="q-title" className="sr-only">
        Question
      </label>
      <textarea
        id="q-title"
        rows={1}
        value={title}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          else if (e.key === "Enter") e.preventDefault();
        }}
        placeholder={mode === "quick" ? `Make a prediction… e.g. “${placeholder}”` : placeholder}
        className="field-sizing-content block max-h-40 w-full resize-none bg-transparent focus-visible:outline-none text-[1.125rem] font-medium leading-snug text-ink outline-none placeholder:font-normal placeholder:text-ink-3"
        autoFocus={mode === "full"}
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
              <BinaryNudge p={probability} track={track} tags={tags} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-medium text-ink-2">How sure?</span>
                <ConfidencePicker value={confidence} onChange={setConfidence} />
                {type === "duration" && <DurationUnitSelect value={durUnit} onChange={setDurUnit} />}
                {type === "numeric" && (
                  <input
                    value={numUnit}
                    onChange={(e) => setNumUnit(e.target.value.slice(0, 30))}
                    placeholder="unit (optional)"
                    aria-label="Unit"
                    className="field w-36 py-1 text-sm"
                  />
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
                tags={tags}
                unit={unitLabel}
                tz={tz}
                onApply={(q) => setDraft(toDraft(kind!, q, durUnit))}
              />
              <p className="text-xs text-ink-3">
                Gut check: would you rather bet on your range, or on a spinner that wins {confidence * 100}% of the time? If the spinner, widen
                your range.
              </p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="q-closes">
                {type === "duration" ? "Plan to finish by" : "Resolve by"} <span className="font-normal text-ink-3">(optional)</span>
              </Label>
              <div className="flex gap-2">
                <input
                  id="q-closes"
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
                {hydrated && deadlinePresets().map((p) => (
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
              <span className="mb-1.5 block text-sm font-medium text-ink-2">Share with</span>
              {groups.length ? (
                <GroupPicker groups={groups} value={groupIds} onChange={setGroupIds} />
              ) : (
                <p className="text-sm text-ink-3">
                  Private for now.{" "}
                  <Link href="/groups" className="text-accent-ink hover:underline">
                    Create or join a group
                  </Link>{" "}
                  to forecast with friends.
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="q-tags">
              Tags <span className="font-normal text-ink-3">— your per-tag track record becomes a base rate</span>
            </Label>
            <TagInput id="q-tags" value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink"
              aria-expanded={showMore}
            >
              <ChevronDown size={16} className={cn("transition-transform", showMore && "rotate-180")} />
              Details, reasoning{type === "numeric" ? ", scale" : ""}
            </button>
            {showMore && (
              <div className="mt-3 space-y-4">
                <div>
                  <Label htmlFor="q-details">Resolution criteria / details</Label>
                  <textarea
                    id="q-details"
                    rows={2}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="What exactly counts? Make it unambiguous for future-you."
                    className="field field-sizing-content min-h-16 resize-y"
                  />
                </div>
                <div>
                  <Label htmlFor="q-note">Why do you think this? (private reasoning, shown next to your forecast)</Label>
                  <textarea
                    id="q-note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reference class, key uncertainty, what would change your mind…"
                    className="field field-sizing-content min-h-16 resize-y"
                  />
                </div>
                {type === "numeric" && (
                  <label className="flex items-start gap-2.5 text-sm text-ink-2">
                    <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} className="mt-1 accent-[var(--accent)]" />
                    <span>
                      <span className="font-medium text-ink">Measure errors as ratios (log scale)</span>
                      <br />
                      For positive quantities that vary by multiples — money, counts, populations. Being off by 2× counts the same whether
                      the answer is 10 or 10,000.
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
            {type === "duration" && (
              <label className="mr-auto flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked={startTimer} onChange={(e) => setStartTimer(e.target.checked)} className="accent-[var(--accent)]" />
                <Play size={14} /> Start the timer now
              </label>
            )}
            <span className="hidden text-xs text-ink-3 sm:inline">⌘↵ to save</span>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Make prediction"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
