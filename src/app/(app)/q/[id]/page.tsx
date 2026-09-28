import { ArrowLeft, Globe, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IntervalStrip, type StripRow } from "@/components/charts/interval-strip";
import { ProbabilityTimeline } from "@/components/charts/probability-timeline";
import { DeleteQuestionButton, EditQuestion, ReflectionForm, ResolvePanel, UnresolveButton } from "@/components/question/author-tools";
import { Comments } from "@/components/question/comments";
import { ForecastForm } from "@/components/question/forecast-form";
import { ForecastSummary, OutcomeBadge, RecordBadge, TypeIcon } from "@/components/questions/bits";
import { TimerCard } from "@/components/questions/timer-card";
import { Avatar, Badge, Card, SectionHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { TYPE_LABELS } from "@/lib/constants";
import { getTrackRecord } from "@/lib/data/composer";
import { getQuestionDetail, getVisibleQuestion, isOpenForForecasts, type ForecastView } from "@/lib/data/questions";
import { fmtDate, fmtRatio, fmtValue, pct, percentileText, relativeTime } from "@/lib/format";
import { requestNow } from "@/lib/request-time";
import { median } from "@/lib/scoring/math";
import { effectiveScale, relativeScores, type ScoredRecord } from "@/lib/scoring/records";

export async function generateMetadata({ params }: PageProps<"/q/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const q = await getVisibleQuestion((await params).id, user.id);
  return { title: q?.title ?? "Question" };
}

function latestByUser(fs: ForecastView[]) {
  const m = new Map<string, ForecastView>();
  for (const f of fs) m.set(f.userId, f); // ascending order → last wins
  return [...m.values()];
}

export default async function QuestionPage({ params, searchParams }: PageProps<"/q/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getQuestionDetail(id, user.id);
  if (!detail) notFound();
  const { question: q, isAuthor, revealed } = detail;
  const { track } = await getTrackRecord(user.id);
  const tz = user.timezone;
  const now = requestNow();
  const open = isOpenForForecasts(q, now);
  const overdue = !q.resolvedAt && !q.workStartedAt && !!q.closesAt && q.closesAt.getTime() < now;
  const scale = effectiveScale(q);
  const mine = detail.forecasts.filter((f) => f.userId === user.id);
  const myLatest = mine[mine.length - 1] ?? null;
  const latest = latestByUser(detail.forecasts);
  const others = detail.forecasterCount - (myLatest ? 1 : 0);
  const myRecord = detail.records.find((r) => r.userId === user.id) ?? null;
  const rel = relativeScores(detail.records);
  const nameOf = (f: { user: { id: string; displayName: string } }) => (f.user.id === user.id ? "You" : f.user.displayName);

  let status: React.ReactNode;
  if (q.resolvedAt) status = <OutcomeBadge q={q} tz={tz} />;
  else if (q.workStartedAt) status = <Badge tone="accent">In progress</Badge>;
  else if (overdue) status = <Badge tone="warn">Needs resolution</Badge>;
  else if (q.closesAt) status = <Badge>Closes {relativeTime(q.closesAt, now)}</Badge>;
  else status = <Badge>Open</Badge>;

  // Continuous: everyone's latest interval (+ a group aggregate when there's a crowd)
  const stripRows: StripRow[] = [];
  if (q.type !== "binary") {
    const rows = latest.filter((f) => f.low != null && f.median != null && f.high != null);
    rows.sort((a, b) => (a.userId === user.id ? -1 : b.userId === user.id ? 1 : 0));
    for (const f of rows) {
      stripRows.push({ key: f.id, name: nameOf(f), low: f.low!, median: f.median!, high: f.high!, emphasis: f.userId === user.id ? "you" : undefined });
    }
    if (rows.length >= 3) {
      stripRows.push({
        key: "group",
        name: "Group (median of each)",
        low: median(rows.map((f) => f.low!)),
        median: median(rows.map((f) => f.median!)),
        high: median(rows.map((f) => f.high!)),
        emphasis: "group",
      });
    }
  }

  // Binary: probability over time per person
  const timeline =
    q.type === "binary"
      ? [...new Set(detail.forecasts.map((f) => f.userId))]
          .sort((a, b) => (a === user.id ? -1 : b === user.id ? 1 : 0))
          .map((uid) => {
            const fs = detail.forecasts.filter((f) => f.userId === uid && f.probability != null);
            return { name: nameOf(fs[0]), isYou: uid === user.id, points: fs.map((f) => ({ t: f.createdAt.getTime(), p: f.probability! })) };
          })
      : [];
  const timelineEnd = (q.resolvedAt ?? (q.closesAt && q.closesAt.getTime() < now ? q.closesAt : null))?.getTime() ?? now;

  const scoreRows = [...detail.records].sort((a, b) =>
    a.kind === "binary" && b.kind === "binary" ? a.brier - b.brier : a.kind === "continuous" && b.kind === "continuous" ? a.intervalScore - b.intervalScore : 0,
  );
  const userName = new Map(detail.forecasts.map((f) => [f.userId, nameOf(f)]));

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink-2">
        <ArrowLeft size={14} /> All predictions
      </Link>

      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="outline">
            <TypeIcon type={q.type} size={12} /> {TYPE_LABELS[q.type]}
          </Badge>
          {status}
        </div>
        <h1 className="max-w-3xl font-serif text-[2.1rem] leading-[1.1] tracking-[-0.01em] text-ink sm:text-[2.5rem]">{q.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={q.author.displayName} src={q.author.avatarUrl} size={20} />
            <span className="text-ink-2">{isAuthor ? "You" : q.author.displayName}</span>
          </span>
          <span>asked {relativeTime(q.createdAt, now)}</span>
          {q.closesAt && <span>resolve by {fmtDate(q.closesAt, tz, "dateTime")}</span>}
          <span className="inline-flex items-center gap-1">
            {q.visibility === "public" ? (
              <>
                <Globe size={13} /> Public
              </>
            ) : (
              <>
                <Lock size={13} /> Only you
              </>
            )}
          </span>
        </div>
        {q.details && <p className="mt-4 max-w-3xl whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-2">{q.details}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {q.resolvedAt && (
            <Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-ink-3">Resolved {fmtDate(q.resolvedAt, tz, "day")}</span>
                {q.resolution === "value" && q.resolutionValue != null ? (
                  <span className="text-2xl font-semibold text-ink">{fmtValue(q, q.resolutionValue, tz)}</span>
                ) : (
                  <span className="text-2xl font-semibold text-ink">{q.resolution === "yes" ? "Yes" : q.resolution === "no" ? "No" : "Ambiguous"}</span>
                )}
              </div>
              {myRecord && <YourResult r={myRecord} q={q} tz={tz} relMean={rel.get(user.id)} />}
              {q.resolutionNote && !(isAuthor && sp.done) && (
                <blockquote className="mt-4 border-l-2 border-line-strong pl-3 text-[0.9375rem] italic text-ink-2">{q.resolutionNote}</blockquote>
              )}
              {isAuthor && (sp.done || !q.resolutionNote) && q.resolution !== "ambiguous" && (
                <div className="mt-4 border-t border-line pt-4">
                  <ReflectionForm
                    id={q.id}
                    initial={q.resolutionNote}
                    prompt={
                      myRecord?.kind === "continuous" && myRecord.hit < 0.5
                        ? "Outside your range. What did you miss?"
                        : "Anything to remember for next time?"
                    }
                  />
                </div>
              )}
            </Card>
          )}

          {q.type === "duration" && isAuthor && !q.resolvedAt && (
            <div>
              <SectionHeader
                title="Task timer"
                subtitle={q.workStartedAt ? "Forecasting locked when you started." : "Start when you begin working; forecasting locks then."}
              />
              <TimerCard
                serverNow={now}
                showTitle={false}
                allowReset
                t={{
                  id: q.id,
                  title: q.title,
                  runningSince: q.timerRunningSince?.getTime() ?? null,
                  accumulatedMs: q.timerAccumulatedMs,
                  median: myLatest?.median ?? null,
                  low: myLatest?.low ?? null,
                  high: myLatest?.high ?? null,
                }}
              />
            </div>
          )}

          {open && (
            <ForecastForm
              q={{ id: q.id, type: q.type, unit: q.unit, scale, confidence: q.confidence, tags: [] }}
              latest={myLatest}
              track={track}
              tz={tz}
              othersCount={others}
            />
          )}

          <section>
            <SectionHeader
              title="Forecasts"
              subtitle={`${detail.forecasterCount} ${detail.forecasterCount === 1 ? "person" : "people"}${q.type !== "binary" ? ` · ${q.confidence * 100}% ranges` : ""}`}
            />
            {!revealed && others > 0 ? (
              <Card className="flex items-center gap-3 p-5 text-sm text-ink-2">
                <Lock size={18} className="shrink-0 text-ink-3" />
                <span>
                  {others} {others === 1 ? "forecast is" : "forecasts are"} hidden until you make yours — so you form your own view before
                  seeing anyone else&apos;s.
                </span>
              </Card>
            ) : detail.forecasts.length === 0 ? (
              <Card className="p-5 text-sm text-ink-3">No forecasts yet.</Card>
            ) : (
              <Card className="space-y-5 p-4 sm:p-5">
                {q.type === "binary" ? (
                  <ProbabilityTimeline
                    series={timeline}
                    start={Math.min(q.createdAt.getTime(), ...detail.forecasts.map((f) => f.createdAt.getTime()))}
                    end={timelineEnd}
                    outcome={q.resolution === "yes" || q.resolution === "no" ? q.resolution : null}
                    tz={tz}
                  />
                ) : (
                  <IntervalStrip rows={stripRows} actual={q.resolution === "value" ? q.resolutionValue : null} scaleType={scale} q={q} tz={tz} />
                )}
                <ul className="divide-y divide-line border-t border-line">
                  {[...detail.forecasts].reverse().map((f) => (
                    <li key={f.id} className="flex items-start gap-3 py-2.5 text-sm">
                      <Avatar name={f.user.displayName} src={f.user.avatarUrl} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium text-ink">{nameOf(f)}</span>
                          <ForecastSummary q={q} f={f} tz={tz} />
                          <span className="text-xs text-ink-3">{relativeTime(f.createdAt, now)}</span>
                        </div>
                        {f.note && <p className="mt-0.5 whitespace-pre-wrap text-ink-2">{f.note}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          {scoreRows.length > 0 && (
            <section>
              <SectionHeader
                title="Scores"
                subtitle={q.type === "binary" ? "Time-weighted Brier score (lower is better)" : "Time-weighted, using each person's standing range"}
              />
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-3">
                      <th className="px-4 py-2 font-medium">Forecaster</th>
                      <th className="px-4 py-2 font-medium">{q.type === "binary" ? "Avg forecast" : "Final range"}</th>
                      <th className="px-4 py-2 font-medium">Result</th>
                      {scoreRows.length > 1 && <th className="px-4 py-2 font-medium">vs. others</th>}
                    </tr>
                  </thead>
                  <tbody className="tnum">
                    {scoreRows.map((r) => {
                      const rs = rel.get(r.userId);
                      const relVal = r.kind === "binary" ? rs?.binary?.mean : rs?.continuous?.mean;
                      return (
                        <tr key={r.userId} className="border-b border-line/60 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-ink">{userName.get(r.userId)}</td>
                          <td className="px-4 py-2.5 text-ink-2">
                            {r.kind === "binary" ? pct(r.meanP) : <ForecastSummary q={q} f={r.final} tz={tz} />}
                          </td>
                          <td className="px-4 py-2.5">
                            <RecordBadge r={r} />
                          </td>
                          {scoreRows.length > 1 && (
                            <td className={relVal == null ? "px-4 py-2.5 text-ink-3" : relVal <= 0 ? "px-4 py-2.5 text-good-ink" : "px-4 py-2.5 text-bad-ink"}>
                              {relVal == null ? "–" : `${relVal <= 0 ? "better" : "worse"} by ${Math.abs(relVal).toFixed(2)}`}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </section>
          )}

          <section>
            <SectionHeader title="Discussion" />
            {revealed || detail.commentCount === 0 ? (
              <Comments
                questionId={q.id}
                viewerId={user.id}
                items={detail.comments.map((c) => ({ id: c.id, body: c.body, when: relativeTime(c.createdAt, now), user: c.user }))}
              />
            ) : (
              <Card className="flex items-center gap-3 p-5 text-sm text-ink-2">
                <Lock size={18} className="shrink-0 text-ink-3" />
                {detail.commentCount} {detail.commentCount === 1 ? "comment" : "comments"} hidden until you forecast.
              </Card>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {isAuthor && !q.resolvedAt && (
            <ResolvePanel q={{ id: q.id, type: q.type, unit: q.unit, scale }} overdue={overdue} />
          )}
          {mine.length > 0 && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-2 font-semibold text-ink">Your forecast history</h2>
              <ol className="space-y-2.5">
                {[...mine].reverse().map((f, i) => (
                  <li key={f.id} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <ForecastSummary q={q} f={f} tz={tz} className={i > 0 ? "opacity-60" : undefined} />
                      <span className="shrink-0 text-xs text-ink-3">{fmtDate(f.createdAt, tz, "dateTime")}</span>
                    </div>
                    {f.note && <p className="mt-0.5 text-ink-3">{f.note}</p>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {isAuthor && (
            <div className="flex flex-wrap items-start gap-1">
              <EditQuestion
                q={{
                  id: q.id,
                  title: q.title,
                  details: q.details,
                  visibility: q.visibility,
                  closesAt: q.closesAt?.getTime() ?? null,
                }}
              />
              {q.resolvedAt && <UnresolveButton id={q.id} />}
              <DeleteQuestionButton id={q.id} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function YourResult({
  r,
  q,
  tz,
  relMean,
}: {
  r: ScoredRecord;
  q: { type: "binary" | "numeric" | "duration" | "date"; unit: string | null };
  tz: string;
  relMean?: { binary: { mean: number } | null; continuous: { mean: number } | null };
}) {
  if (r.kind === "binary") {
    const said = r.meanP;
    const right = (said > 0.5 && r.outcome === 1) || (said < 0.5 && r.outcome === 0);
    return (
      <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
        You said <b className="text-ink">{pct(said)}</b> — {said === 0.5 ? "a pure toss-up" : right ? "leaning the right way" : "leaning the wrong way"}.
        Brier <b className="text-ink">{r.brier.toFixed(3)}</b> (0 is perfect; always saying 50% scores 0.25).
        {relMean?.binary && (
          <> {relMean.binary.mean <= 0 ? "Better" : "Worse"} than the group median by {Math.abs(relMean.binary.mean).toFixed(3)}.</>
        )}
      </div>
    );
  }
  const inside = r.hit >= 0.5;
  const pctile = Math.round(r.percentile * 100);
  return (
    <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
      {inside ? (
        <>
          <b className="text-good-ink">✓ Inside your range.</b>{" "}
        </>
      ) : (
        <>
          <b className="text-bad-ink">✗ Outside your range.</b>{" "}
        </>
      )}
      Reality landed <b className="text-ink">{percentileText(r.percentile)}</b> of your forecast
      {pctile >= 90 ? " — much higher than you expected" : pctile <= 10 ? " — much lower than you expected" : ""}.
      {q.type === "duration" && r.ratio != null && (
        <>
          {" "}
          {r.ratio >= 1 ? (
            <>
              It took <b className="text-ink">{fmtRatio(r.ratio)}</b> your best guess
            </>
          ) : (
            <>
              It went <b className="text-ink">{fmtRatio(1 / r.ratio)}</b> quicker than your best guess
            </>
          )}{" "}
          ({fmtValue(q, r.final.median, tz)} → {fmtValue(q, r.actual, tz)}).
        </>
      )}
    </div>
  );
}
