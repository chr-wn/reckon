"use client";

import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { Badge, Button, Card, cn, ErrorText } from "@/components/ui";
import { startRound, submitCompare, submitInterval } from "@/lib/actions/drills";
import type { CompareResult, DrillItem, DrillMode, IntervalResult } from "@/lib/drills/engine";
import { pct } from "@/lib/format";

const MODE_LABELS: Record<DrillMode, { title: string; body: string }> = {
  mixed: { title: "Mixed", body: "Half ranges, half which-is-bigger." },
  interval: { title: "Ranges", body: "Give a range you're X% sure contains the answer." },
  compare: { title: "Which is bigger?", body: "Pick an answer and say how sure you are." },
};

const numFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmt = (v: number, unit: string | null, isYear: boolean) => {
  if (isYear) return v < 0 ? `${-v} BC` : String(v);
  const n = numFmt.format(v).replace("-", "−");
  return unit ? (unit.startsWith("°") ? `${n}${unit}` : `${n} ${unit}`) : n;
};
const parseNum = (s: string) => {
  const v = Number(s.replace(/[,\s]/g, "").replace(/[−–]/g, "-"));
  return s.trim() && Number.isFinite(v) ? v : null;
};

type Answer =
  | { kind: "interval"; low: number; high: number; result: IntervalResult }
  | { kind: "compare"; pFirst: number; result: CompareResult };

export function DrillRunner() {
  const router = useRouter();
  const [mode, setMode] = useState<DrillMode>("mixed");
  const [confidence, setConfidence] = useState(0.8);
  const [round, setRound] = useState<{ id: string; items: DrillItem[] } | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [index, setIndex] = useState(0);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      const r = await startRound(mode);
      setRound({ id: r.roundId, items: r.items });
      setAnswers([]);
      setIndex(0);
    });

  if (!round) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Start a round</h2>
        <p className="mb-4 text-sm text-ink-2">10 questions, instant feedback. Takes about two minutes.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(MODE_LABELS) as DrillMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                mode === m ? "border-ink bg-surface-2" : "border-line-strong hover:border-ink/40",
              )}
            >
              <div className="font-medium text-ink">{MODE_LABELS[m].title}</div>
              <div className="mt-0.5 text-xs text-ink-3">{MODE_LABELS[m].body}</div>
            </button>
          ))}
        </div>
        {mode !== "compare" && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            Ranges at
            <div className="inline-flex rounded-lg border border-line-strong p-0.5">
              {[0.5, 0.8, 0.9].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConfidence(c)}
                  className={cn("rounded-md px-2.5 py-1 text-sm font-medium", confidence === c ? "bg-ink text-surface" : "text-ink-2 hover:text-ink")}
                >
                  {c * 100}%
                </button>
              ))}
            </div>
            confidence
          </div>
        )}
        <Button className="mt-5" size="lg" onClick={begin} disabled={pending}>
          {pending ? "Shuffling…" : "Start"} <ArrowRight size={16} />
        </Button>
      </Card>
    );
  }

  const done = answers.length === round.items.length && index >= round.items.length;
  if (done) {
    return (
      <Summary
        answers={answers}
        confidence={confidence}
        onAgain={() => {
          setRound(null);
          router.refresh();
        }}
      />
    );
  }

  const item = round.items[index];
  const answer = answers[index];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${((index + (answer ? 1 : 0)) / round.items.length) * 100}%` }} />
        </div>
        <span className="text-sm tnum text-ink-3">
          {index + 1} / {round.items.length}
        </span>
      </div>
      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Badge>{item.category}</Badge>
          <Badge tone="outline">{item.kind === "interval" ? `${confidence * 100}% range` : "Which one?"}</Badge>
        </div>
        {item.kind === "interval" ? (
          <IntervalQuestion
            key={item.key}
            item={item}
            confidence={confidence}
            answer={answer?.kind === "interval" ? answer : undefined}
            onSubmit={async (low, high) => {
              const r = await submitInterval(round.id, item.key, low, high, confidence);
              if (!r.ok) return r.error;
              setAnswers((a) => [...a.slice(0, index), { kind: "interval", low, high, result: r.data }]);
              return null;
            }}
            onNext={() => setIndex((i) => i + 1)}
          />
        ) : (
          <CompareQuestion
            key={item.key}
            item={item}
            answer={answer?.kind === "compare" ? answer : undefined}
            onSubmit={async (pFirst) => {
              const r = await submitCompare(round.id, item.key, pFirst);
              if (!r.ok) return r.error;
              setAnswers((a) => [...a.slice(0, index), { kind: "compare", pFirst, result: r.data }]);
              return null;
            }}
            onNext={() => setIndex((i) => i + 1)}
          />
        )}
      </Card>
    </div>
  );
}

function useEnter(handler: () => void, active: boolean) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}

function Feedback({ correct, title, children }: { correct: boolean; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={cn("mt-5 rounded-xl px-4 py-3 text-sm text-ink-2", correct ? "bg-good-soft" : "bg-bad-soft")} role="status">
      <div className={cn("flex items-center gap-1.5 font-semibold", correct ? "text-good-ink" : "text-bad-ink")}>
        {correct ? <Check size={16} /> : <X size={16} />}
        {title}
      </div>
      {children && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
}

function IntervalQuestion({
  item,
  confidence,
  answer,
  onSubmit,
  onNext,
}: {
  item: Extract<DrillItem, { kind: "interval" }>;
  confidence: number;
  answer?: Extract<Answer, { kind: "interval" }>;
  onSubmit: (low: number, high: number) => Promise<string | null>;
  onNext: () => void;
}) {
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tail = pct((1 - confidence) / 2);
  const submit = () => {
    const l = parseNum(low);
    const h = parseNum(high);
    if (l == null || h == null) return setError("Enter both ends of your range.");
    setError(null);
    start(async () => setError(await onSubmit(Math.min(l, h), Math.max(l, h))));
  };
  useEnter(answer ? onNext : submit, true);
  const r = answer?.result;

  return (
    <div>
      <p className="text-xl font-medium leading-snug text-ink sm:text-2xl">{item.question}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {(
          [
            ["Low end", `${tail} chance it's lower`, low, setLow],
            ["High end", `${tail} chance it's higher`, high, setHigh],
          ] as const
        ).map(([label, sub, value, set], i) => (
          <label key={label} className="block">
            <span className="block text-sm font-medium text-ink-2">{label}</span>
            <span className="mb-1.5 block text-xs text-ink-3">{sub}</span>
            <div className="relative">
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                autoFocus={i === 0}
                disabled={!!answer}
                className={cn("field text-lg tnum", item.unit && "pr-16")}
              />
              {item.unit && (
                <span className="pointer-events-none absolute right-3 top-1/2 max-w-14 -translate-y-1/2 truncate text-xs text-ink-3">{item.unit}</span>
              )}
            </div>
          </label>
        ))}
      </div>
      {item.isYear && !answer && <p className="mt-2 text-xs text-ink-3">A year, e.g. 1850.</p>}
      <ErrorText>{error}</ErrorText>
      {r && answer ? (
        <>
          <Feedback correct={r.correct} title={r.correct ? "Inside your range" : "Outside your range"}>
            <p>
              Answer: <b className="text-ink">{fmt(r.answer, r.unit, r.isYear)}</b> · your range {fmt(answer.low, r.unit, r.isYear)} –{" "}
              {fmt(answer.high, r.unit, r.isYear)}
            </p>
            {r.note && <p className="text-ink-3">{r.note}</p>}
          </Feedback>
          <div className="mt-3 flex justify-end">
            <Button onClick={onNext}>
              Next <ArrowRight size={16} />
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-3">Would you rather bet on your range, or a {confidence * 100}% spinner? Adjust until it&apos;s a toss-up.</p>
          <Button onClick={submit} disabled={pending}>
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

function CompareQuestion({
  item,
  answer,
  onSubmit,
  onNext,
}: {
  item: Extract<DrillItem, { kind: "compare" }>;
  answer?: Extract<Answer, { kind: "compare" }>;
  onSubmit: (pFirst: number) => Promise<string | null>;
  onNext: () => void;
}) {
  // Slider position 0 (sure it's A) … 100 (sure it's B); 50 = no idea.
  const [pos, setPos] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pFirst = Math.min(0.99, Math.max(0.01, 1 - pos / 100));
  const lean = pos === 50 ? null : pos < 50 ? "a" : "b";
  const conf = Math.max(pFirst, 1 - pFirst);
  const submit = () => {
    setError(null);
    start(async () => setError(await onSubmit(pFirst)));
  };
  useEnter(answer ? onNext : submit, true);
  const r = answer?.result;
  const option = (which: "a" | "b") => {
    const label = which === "a" ? item.a : item.b;
    const right = r ? (which === "a") === r.firstRight : null;
    const value = r ? (which === "a" ? r.aValue : r.bValue) : null;
    return (
      <button
        type="button"
        disabled={!!answer}
        onClick={() => setPos(which === "a" ? Math.min(pos, 25) : Math.max(pos, 75))}
        className={cn(
          "flex-1 rounded-xl border p-3 text-left text-[0.9375rem] font-medium transition-colors disabled:cursor-default",
          right === true
            ? "border-good/50 bg-good-soft text-ink"
            : right === false
              ? "border-line text-ink-3"
              : lean === which
                ? "border-accent bg-accent-soft text-ink"
                : "border-line-strong text-ink hover:border-ink/40",
        )}
      >
        <span className="first-letter:uppercase">{label}</span>
        {value != null && r && <span className="mt-1 block text-sm font-normal text-ink-2">{fmt(value, r.unit, r.isYear)}</span>}
      </button>
    );
  };

  return (
    <div>
      <p className="text-xl font-medium leading-snug text-ink sm:text-2xl">{item.prompt}</p>
      <div className="mt-5 flex gap-3">
        {option("a")}
        {option("b")}
      </div>
      <div className="mt-5">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pos}
          disabled={!!answer}
          onChange={(e) => setPos(Number(e.target.value))}
          className="range range-bipolar"
          style={{ "--from": `${Math.min(pos, 50)}%`, "--to": `${Math.max(pos, 50)}%` } as CSSProperties}
          aria-label="How sure are you, and which way?"
          aria-valuetext={lean ? `${pct(conf)} sure: ${lean === "a" ? item.a : item.b}` : "no idea"}
        />
        <div className="mt-1 flex justify-between text-xs text-ink-3">
          <span>sure it&apos;s the first</span>
          <span className="font-medium text-ink-2">{lean ? `${pct(conf)} sure` : "50/50"}</span>
          <span>sure it&apos;s the second</span>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      {r && answer ? (
        <>
          <Feedback
            correct={r.correct}
            title={conf === 0.5 ? "A coin flip — fair enough" : r.correct ? `Right, at ${pct(conf)} sure` : `Wrong way, at ${pct(conf)} sure`}
          >
            {r.note && <p className="text-ink-3">{r.note}</p>}
          </Feedback>
          <div className="mt-3 flex justify-end">
            <Button onClick={onNext}>
              Next <ArrowRight size={16} />
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-5 flex justify-end">
          <Button onClick={submit} disabled={pending}>
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

function Summary({ answers, confidence, onAgain }: { answers: Answer[]; confidence: number; onAgain: () => void }) {
  const intervals = answers.filter((a): a is Extract<Answer, { kind: "interval" }> => a.kind === "interval");
  const compares = answers.filter((a): a is Extract<Answer, { kind: "compare" }> => a.kind === "compare");
  const hits = intervals.filter((a) => a.result.correct).length;
  const hitRate = intervals.length ? hits / intervals.length : 0;
  const right = compares.filter((a) => a.result.correct).length;
  const avgConf = compares.length ? compares.reduce((s, a) => s + Math.max(a.pFirst, 1 - a.pFirst), 0) / compares.length : 0;
  const accuracy = compares.length ? right / compares.length : 0;
  const brier = compares.length ? compares.reduce((s, a) => s + (a.pFirst - (a.result.firstRight ? 1 : 0)) ** 2, 0) / compares.length : 0;

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <h2 className="font-serif text-3xl text-ink">Round done</h2>
      {intervals.length > 0 && (
        <div>
          <div className="text-sm text-ink-3">Ranges</div>
          <div className="text-2xl font-semibold text-ink">
            {hits} / {intervals.length} caught the answer <span className="text-base font-normal text-ink-3">(target {pct(confidence)})</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {hitRate < confidence - 0.15
              ? `Your ranges are too narrow — the classic overconfidence pattern. Next round, picture each end separately: what value would genuinely surprise you ${pct((1 - confidence) / 2)} of the time?`
              : hitRate > confidence + 0.15
                ? "Your ranges are wider than they need to be. You know more than you're admitting — tighten up."
                : "Right around target. One round is a small sample, though — keep going and watch the long-run number."}
          </p>
        </div>
      )}
      {compares.length > 0 && (
        <div>
          <div className="text-sm text-ink-3">Which is bigger?</div>
          <div className="text-2xl font-semibold text-ink">
            {right} / {compares.length} right <span className="text-base font-normal text-ink-3">at {pct(avgConf)} average confidence</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {accuracy < avgConf - 0.12
              ? "You were more confident than accurate. Try pulling your confident answers toward the middle."
              : accuracy > avgConf + 0.12
                ? "You were more accurate than confident — you can afford to commit harder."
                : "Confidence and accuracy roughly matched. Nice."}{" "}
            Brier this round: {brier.toFixed(3)}.
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button onClick={onAgain}>
          <RotateCcw size={15} /> Another round
        </Button>
        <Link href="/stats#drills" className="inline-flex h-10 items-center px-3 text-sm font-medium text-accent-ink hover:underline">
          All-time drill stats →
        </Link>
      </div>
    </Card>
  );
}
