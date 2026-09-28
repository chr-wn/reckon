import type { Metadata } from "next";
import { DrillRunner } from "@/components/drills/drill-runner";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getDrillSummary } from "@/lib/data/drills";
import { FACT_COUNT } from "@/lib/drills/engine";
import { pct } from "@/lib/format";

export const metadata: Metadata = { title: "Drills" };

export default async function DrillsPage() {
  const user = await requireUser();
  const s = await getDrillSummary(user.id);
  return (
    <div>
      <PageHeader
        title="Calibration drills"
        subtitle="Real predictions take days or weeks to resolve. Trivia takes seconds — so you can get hundreds of reps of honest feedback."
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <DrillRunner />
        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-ink">Your drill record</h2>
            {s.total === 0 ? (
              <p className="text-sm text-ink-2">No rounds yet. Most people&apos;s first 80% ranges catch the answer only about half the time.</p>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Answered</dt>
                  <dd className="font-medium text-ink tnum">{s.total}</dd>
                </div>
                {s.byLevel.map((l) => (
                  <div key={l.confidence} className="flex justify-between gap-3">
                    <dt className="text-ink-3">{pct(l.confidence)} ranges caught</dt>
                    <dd className="font-medium text-ink tnum">
                      {pct(l.hitRate)} <span className="font-normal text-ink-3">of {l.n}</span>
                    </dd>
                  </div>
                ))}
                {s.compare && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-3">Comparison Brier</dt>
                    <dd className="font-medium text-ink tnum">{s.compare.brier.toFixed(3)}</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>
          <Card className="p-5 text-sm leading-relaxed text-ink-2">
            <h2 className="mb-2 font-semibold text-ink">How to use these</h2>
            <ul className="list-disc space-y-1.5 pl-4">
              <li>Don&apos;t look things up — the point is to measure what you know.</li>
              <li>Aim for the target hit rate, not 100%. Too many hits means your ranges are too wide.</li>
              <li>For each end of a range, ask: what would genuinely surprise me?</li>
              <li>{FACT_COUNT} fact-checked questions; you&apos;ll see unseen ones first.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
