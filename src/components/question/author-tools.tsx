"use client";

import { Pencil, Trash2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { fromDateInput } from "@/components/forecast/quantiles";
import { GroupPicker } from "@/components/group-picker";
import { TagInput } from "@/components/tag-input";
import { Button, Card, ErrorText, Label } from "@/components/ui";
import { deleteQuestion, resolveQuestion, saveReflection, unresolveQuestion, updateQuestion } from "@/lib/actions/questions";
import { DURATION_UNITS, type DurationUnit } from "@/lib/constants";
import { toMinutes } from "@/lib/format";
import { fromDateTimeInput, toDateTimeInput } from "@/lib/parse-date";

interface Q {
  id: string;
  type: "binary" | "numeric" | "duration" | "date";
  unit: string | null;
  scale: "linear" | "log";
}

export function ResolvePanel({ q, overdue }: { q: Q; overdue: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<DurationUnit>(DURATION_UNITS.includes(q.unit as DurationUnit) ? (q.unit as DurationUnit) : "minutes");

  const run = (input: Parameters<typeof resolveQuestion>[1]) =>
    start(async () => {
      const r = await resolveQuestion(q.id, input);
      if (!r.ok) setError(r.error);
    });

  function resolveValue() {
    setError(null);
    let v: number | null;
    if (q.type === "date") v = fromDateInput(value);
    else {
      const n = Number(value.replace(/,/g, ""));
      v = value.trim() && Number.isFinite(n) ? (q.type === "duration" ? toMinutes(n, unit) : n) : null;
    }
    if (v == null) return setError("Enter the actual value.");
    run({ resolution: "value", value: v, note });
  }

  return (
    <Card className={overdue ? "border-warn/60 p-4 ring-2 ring-warn/25 sm:p-5" : "p-4 sm:p-5"} id="resolve">
      <h2 className="font-semibold text-ink">{overdue ? "What happened?" : "Resolve"}</h2>
      <p className="mb-3 text-sm text-ink-3">{overdue ? "This is past its resolve-by date." : "Know the answer already? Resolve it early."}</p>
      <div className="space-y-3">
        {q.type === "binary" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="yes" disabled={pending} onClick={() => run({ resolution: "yes", note })}>
              ✓ Yes
            </Button>
            <Button variant="no" disabled={pending} onClick={() => run({ resolution: "no", note })}>
              ✗ No
            </Button>
          </div>
        ) : (
          <div>
            <Label htmlFor="actual">{q.type === "duration" ? "How long did it actually take?" : q.type === "date" ? "When did it happen?" : "Actual value"}</Label>
            <div className="flex gap-2">
              <input
                id="actual"
                type={q.type === "date" ? "date" : "text"}
                inputMode={q.type === "date" ? undefined : "decimal"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="field tnum"
                placeholder={q.type === "numeric" && q.unit ? q.unit : undefined}
              />
              {q.type === "duration" && (
                <select value={unit} onChange={(e) => setUnit(e.target.value as DurationUnit)} className="field w-auto" aria-label="Unit">
                  {DURATION_UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reflection: what surprised you? What would you tell past-you?"
          className="field field-sizing-content min-h-16 resize-y text-sm"
          aria-label="Reflection"
        />
        {q.type !== "binary" && (
          <Button className="w-full" disabled={pending} onClick={resolveValue}>
            Resolve
          </Button>
        )}
        <ErrorText>{error}</ErrorText>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ resolution: "ambiguous", note })}
          className="text-xs text-ink-3 hover:text-ink-2 hover:underline"
        >
          Resolve as ambiguous (doesn&apos;t count for scoring)
        </button>
      </div>
    </Card>
  );
}

export function UnresolveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => confirm("Undo the resolution? Scores will be recalculated when you resolve again.") && start(async () => void (await unresolveQuestion(id)))}
    >
      <Undo2 size={14} /> Undo resolution
    </Button>
  );
}

export function ReflectionForm({ id, initial, prompt }: { id: string; initial: string | null; prompt: string }) {
  const [note, setNote] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor="reflection">{prompt}</Label>
      <textarea
        id="reflection"
        rows={2}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. I forgot the write-up takes as long as the problems."
        className="field field-sizing-content min-h-16 resize-y text-sm"
      />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-good-ink">Saved ✓</span>}
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveReflection(id, note);
              if (r.ok) setSaved(true);
            })
          }
        >
          Save reflection
        </Button>
      </div>
    </div>
  );
}

export function EditQuestion({
  q,
  groups,
  tagSuggestions,
}: {
  q: { id: string; title: string; details: string | null; tags: string[]; closesAt: number | null; groupIds: string[] };
  groups: { id: string; name: string }[];
  tagSuggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(q.title);
  const [details, setDetails] = useState(q.details ?? "");
  const [tags, setTags] = useState(q.tags);
  const [closes, setCloses] = useState(q.closesAt ? toDateTimeInput(new Date(q.closesAt)) : "");
  const [groupIds, setGroupIds] = useState(q.groupIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil size={14} /> Edit question
      </Button>
    );
  }
  return (
    <Card className="space-y-3 p-4">
      <div>
        <Label htmlFor="e-title">Question</Label>
        <textarea id="e-title" rows={2} value={title} onChange={(e) => setTitle(e.target.value)} className="field field-sizing-content resize-y" />
      </div>
      <div>
        <Label htmlFor="e-details">Details</Label>
        <textarea id="e-details" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} className="field field-sizing-content min-h-16 resize-y text-sm" />
      </div>
      <div>
        <Label htmlFor="e-closes">Resolve by</Label>
        <input id="e-closes" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} className="field tnum" />
      </div>
      <div>
        <Label>Tags</Label>
        <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
      </div>
      {groups.length > 0 && (
        <div>
          <Label>Shared with</Label>
          <GroupPicker groups={groups} value={groupIds} onChange={setGroupIds} />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateQuestion(q.id, {
                title,
                details,
                tags,
                groupIds,
                closesAt: fromDateTimeInput(closes)?.getTime() ?? null,
              });
              if (!r.ok) setError(r.error);
              else setOpen(false);
            })
          }
        >
          Save
        </Button>
      </div>
    </Card>
  );
}

export function DeleteQuestionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-bad-ink hover:bg-bad-soft hover:text-bad-ink"
      disabled={pending}
      onClick={() => confirm("Delete this question and everyone's forecasts on it? This can't be undone.") && start(() => deleteQuestion(id))}
    >
      <Trash2 size={14} /> Delete
    </Button>
  );
}

