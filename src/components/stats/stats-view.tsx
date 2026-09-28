import { CalibrationChart, CalibrationTable } from "@/components/charts/calibration-chart";
import { DataTable, Figure } from "@/components/charts/chart-kit";
import { CoverageBars } from "@/components/charts/coverage-bars";
import { PitHistogram } from "@/components/charts/pit-histogram";
import { TrendChart } from "@/components/charts/trend-chart";
import { Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { fmtRatio, pct } from "@/lib/format";
import { MIN_FOR_VERDICT, recalibrate, yesBias } from "@/lib/scoring/binary";
import { brierTrend, hitRateTrend, multiplierTrend, summarize, type ScoredRecord } from "@/lib/scoring/records";
import { VERDICT_COPY } from "@/lib/verdicts";

export function StatsView({ records, self, tz }: { records: ScoredRecord[]; self: boolean; tz: string }) {
  const s = summarize(records);
  const you = self ? "you" : "they";
  const your = self ? "your" : "their";
  if (s.counts.total === 0) {
    return (
      <EmptyState title="No resolved predictions yet">
        {self
          ? "Stats appear as your predictions resolve. Quick win: time a task tonight."
          : "Nothing resolved that you can see yet."}
      </EmptyState>
    );
  }

  const b = s.binary;
  const c = s.continuous;
  const dur = s.byType.duration;
  const bt = brierTrend(records);
  const ht = hitRateTrend(records);
  const mt = multiplierTrend(records);
  const bias = b ? yesBias(b.fit) : null;

  return (
    <div className="space-y-10">
      <Card className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Resolved" value={s.counts.total} sub={`${s.counts.binary} yes/no · ${s.counts.continuous} ranges`} />
        <Stat label="Brier score" value={b ? b.brier.toFixed(3) : "–"} sub={b ? "0 is perfect · 0.25 = always 50%" : "no yes/no questions yet"} />
        <Stat
          label="Confidence"
          value={<span className="text-xl leading-tight">{b ? VERDICT_COPY[b.verdict].short : "–"}</span>}
          sub={b && b.n < MIN_FOR_VERDICT ? `needs ${MIN_FOR_VERDICT}+ resolved` : `from ${your} yes/no forecasts`}
        />
        <Stat label="Ranges that caught it" value={c ? pct(c.hitRate) : "–"} sub={c ? `aiming for ${pct(c.targetRate)}` : "no range questions yet"} />
        <Stat
          label="Tasks take"
          value={dur?.multiplier != null ? fmtRatio(dur.multiplier) : "–"}
          sub={dur?.multiplier != null ? `${your} best guess, on average` : "time a task to find out"}
        />
      </Card>

      {b && (
        <section>
          <SectionHeader title="Yes / no questions" subtitle={`${Math.round(b.n)} resolved · ${pct(b.meanP)} average forecast · ${pct(b.baseRate)} actually happened`} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Figure
              title="Calibration"
              subtitle="Dots on the diagonal = your probabilities mean what they say"
              table={<CalibrationTable bins={b.bins} />}
            >
              <CalibrationChart bins={b.bins} />
            </Figure>
            <div className="space-y-4">
              <Card className="p-5">
                <div className="font-semibold text-ink">{VERDICT_COPY[b.verdict].short}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{VERDICT_COPY[b.verdict].long}</p>
                {bias && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {bias === "optimistic"
                      ? `Also: things happen less often than ${you} predict — a classic optimism lean. Check ${your} "Will I…?" questions.`
                      : `Also: things happen more often than ${you} predict. ${self ? "You" : "They"} may be a bit pessimistic.`}
                  </p>
                )}
                {b.n >= MIN_FOR_VERDICT && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">What {your} numbers mean in practice</div>
                    <DataTable
                      head={[`When ${you} say`, "Reality (fitted)"]}
                      rows={[0.6, 0.7, 0.8, 0.9, 0.95].map((p) => [pct(p), pct(recalibrate(p, b.fit))])}
                    />
                  </div>
                )}
              </Card>
              {bt.length >= 5 && (
                <Figure title="Brier score over time" subtitle="Rolling average of the last 10 resolved (lower is better)">
                  <TrendChart points={bt} domain={[0, 0.5]} fmt="score" target={0.25} targetLabel="always 50%" valueLabel="Brier" tz={tz} />
                </Figure>
              )}
            </div>
          </div>
        </section>
      )}

      {c && (
        <section>
          <SectionHeader title="Ranges" subtitle={`${Math.round(c.n)} resolved · how long, how much, when`} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Figure title="Did reality land inside the range?" subtitle="Fill = hit rate, black tick = target, grey whisker = 90% range">
                <CoverageBars levels={c.byLevel} />
              </Figure>
              <Card className="space-y-2 p-5 text-sm leading-relaxed text-ink-2">
                <div className="font-semibold text-ink">Reading it</div>
                <p>
                  Reality came in <b className="text-ink">above</b> {your} best guess <b className="text-ink">{pct(c.aboveMedian)}</b> of the time
                  {Math.abs(c.aboveMedian - 0.5) < 0.1 ? " — nicely balanced." : c.aboveMedian > 0.5 ? ` — ${you} tend to guess low.` : ` — ${you} tend to guess high.`}
                </p>
                {c.adjustment.spread > 1.2 && (
                  <p>
                    Outcomes scatter about <b className="text-ink">{c.adjustment.spread.toFixed(1)}×</b> as widely as {your} ranges imply — widen them.
                  </p>
                )}
                {c.adjustment.spread < 0.8 && c.n >= 5 && (
                  <p>
                    {self ? "Your" : "Their"} ranges are wider than they need to be (outcomes cluster tighter than stated). {self ? "You" : "They"} can afford to commit.
                  </p>
                )}
              </Card>
            </div>
            <Figure
              title="Where reality landed"
              subtitle="Percentile of the outcome within each forecast (flat = calibrated)"
              table={
                <DataTable
                  head={["Percentile of your forecast", "Share of outcomes", "Count"]}
                  rows={c.pit.map((p, i) => [`${i * 10}–${i * 10 + 10}th`, pct(p), Math.round(c.pitCounts[i] * 10) / 10])}
                />
              }
              footer="Tall outer bars mean reality often escaped your ranges (too narrow). A lopsided shape means a consistent bias."
            >
              <PitHistogram pit={c.pit} counts={c.pitCounts} />
            </Figure>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {dur && mt.length >= 3 && (
              <Figure
                title="Planning fallacy tracker"
                subtitle={`Actual ÷ best guess for timed tasks, rolling (1× = spot on)`}
                footer={
                  dur.multiplier != null && (
                    <>
                      Overall, tasks take <b className="text-ink">{fmtRatio(dur.multiplier)}</b> {your} best guess; {pct(dur.hitRate)} of{" "}
                      {your} time ranges caught the real duration.
                    </>
                  )
                }
              >
                <TrendChart points={mt} domain={[0.5, 4]} log fmt="ratio" target={1} targetLabel="spot on" valueLabel="Actual ÷ guess" tz={tz} />
              </Figure>
            )}
            {ht.length >= 5 && (
              <Figure title="Range hit rate over time" subtitle="Rolling average of the last 10 resolved range questions">
                <TrendChart points={ht} domain={[0, 1]} fmt="pct" target={c.targetRate} targetLabel={`target ${pct(c.targetRate)}`} valueLabel="Hit" tz={tz} />
              </Figure>
            )}
          </div>
        </section>
      )}

      <details className="group rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-ink-2 shadow-card">
        <summary className="cursor-pointer list-none font-semibold text-ink [&::-webkit-details-marker]:hidden">
          How scoring works <span className="font-normal text-ink-3 group-open:hidden">— show</span>
        </summary>
        <div className="mt-3 space-y-2">
          <p>
            <b className="text-ink">Calibrated</b> means your 70%s happen about 70% of the time, and reality lands inside your 80% ranges about 80%
            of the time — not 100%, which would mean your ranges are too wide.
          </p>
          <p>
            <b className="text-ink">Brier score</b> for yes/no questions is (forecast − outcome)²: 0 is perfect, 0.25 is what always saying 50%
            gets you. It rewards honesty — shading your number never helps on average.
          </p>
          <p>
            <b className="text-ink">Ranges</b> are low end / best guess / high end: with 80% confidence, a 10% chance it&apos;s lower and 10% it&apos;s
            higher. Durations are judged as ratios (&ldquo;took 1.5× your guess&rdquo;).
          </p>
          <p>
            <b className="text-ink">Updating is fine</b>: each forecast counts for as long as it stood, so a last-minute change after you know the
            answer barely moves your score. Friends&apos; forecasts stay hidden until you&apos;ve made your own.
          </p>
          <p>
            <b className="text-ink">Getting better</b>: judge each end of a range separately (&ldquo;what would genuinely surprise me?&rdquo;), start
            from how similar things went before, and multiply time estimates by your own tasks-take number.
          </p>
        </div>
      </details>
    </div>
  );
}
