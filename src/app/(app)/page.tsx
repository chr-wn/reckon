import { ArrowRight, Dumbbell, Users } from "lucide-react";
import Link from "next/link";
import { CalibrationChart } from "@/components/charts/calibration-chart";
import { QuestionComposer } from "@/components/composer/question-composer";
import { Landing } from "@/components/landing";
import { QuestionList } from "@/components/questions/question-list";
import { QuickResolve } from "@/components/questions/quick-resolve";
import { TimerCard } from "@/components/questions/timer-card";
import { ButtonLink, Card, EmptyState, SectionHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { getComposerData } from "@/lib/data/composer";
import { getDrillSummary } from "@/lib/data/drills";
import { getDashboard } from "@/lib/data/questions";
import { requestNow } from "@/lib/request-time";
import { fmtRatio, pct } from "@/lib/format";
import { confidenceVerdict } from "@/lib/scoring/binary";
import { summarize } from "@/lib/scoring/records";
import { VERDICT_COPY } from "@/lib/verdicts";

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const [dash, composer, drills] = await Promise.all([getDashboard(user.id), getComposerData(user.id), getDrillSummary(user.id)]);
  const stats = summarize(composer.records);
  const now = requestNow();
  const firstName = user.displayName.split(" ")[0];
  const summaryBits = [
    dash.toResolve.length && `${dash.toResolve.length} to resolve`,
    dash.awaiting.length && `${dash.awaiting.length} from friends awaiting your forecast`,
  ].filter(Boolean);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-8">
        <div>
          <h1 className="font-serif text-[2.4rem] leading-[1.05] tracking-[-0.01em] text-ink">
            {greeting(user.timezone)}, {firstName}
          </h1>
          <p className="mt-1.5 text-ink-2">{summaryBits.length ? summaryBits.join(" · ") : "What do you think will happen?"}</p>
        </div>

        <QuestionComposer
          mode="quick"
          groups={composer.groups}
          defaultGroupIds={composer.groups.map((g) => g.id)}
          tags={composer.tags}
          track={composer.track}
          tz={user.timezone}
          placeholderIndex={Math.floor(now / 36e5)}
        />

        {dash.inProgress.length > 0 && (
          <section>
            <SectionHeader title="In progress" subtitle="Tasks you're timing" />
            <div className="space-y-3">
              {dash.inProgress.map((q) => {
                const f = q.myForecast;
                return (
                  <TimerCard
                    serverNow={now}
                    key={q.id}
                    t={{
                      id: q.id,
                      title: q.title,
                      runningSince: q.timerRunningSince?.getTime() ?? null,
                      accumulatedMs: q.timerAccumulatedMs,
                      median: f?.median ?? null,
                      low: f?.low ?? null,
                      high: f?.high ?? null,
                    }}
                  />
                );
              })}
            </div>
          </section>
        )}

        {dash.toResolve.length > 0 && (
          <section>
            <SectionHeader title="Time to find out" subtitle="These are past their resolve-by date. What happened?" />
            <QuestionList
              rows={dash.toResolve}
              viewerId={user.id}
              tz={user.timezone}
              now={now}
              trailing={(q) => <QuickResolve id={q.id} type={q.type} />}
            />
          </section>
        )}

        {dash.awaiting.length > 0 && (
          <section>
            <SectionHeader
              title="Your friends want your take"
              subtitle="Forecast before you peek — others' numbers stay hidden until you commit."
            />
            <QuestionList rows={dash.awaiting} viewerId={user.id} tz={user.timezone} now={now} />
          </section>
        )}

        <section>
          <SectionHeader
            title="Your open predictions"
            action={
              <Link href="/questions?scope=mine&status=open" className="text-sm font-medium text-accent-ink hover:underline">
                All →
              </Link>
            }
          />
          {dash.myOpen.length ? (
            <QuestionList rows={dash.myOpen} viewerId={user.id} tz={user.timezone} now={now} showAuthor={false} />
          ) : (
            <EmptyState title="Nothing open right now">
              Predict something that resolves this week — how long tonight&apos;s work will take, whether you&apos;ll hit the gym, when a
              package arrives. <Link href="/new" className="text-accent-ink hover:underline">Need ideas?</Link>
            </EmptyState>
          )}
        </section>

        {dash.recentlyResolved.length > 0 && (
          <section>
            <SectionHeader title="Recently resolved" />
            <QuestionList rows={dash.recentlyResolved} viewerId={user.id} tz={user.timezone} now={now} />
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Your calibration</h2>
            <Link href="/stats" className="text-sm font-medium text-accent-ink hover:underline">
              Details →
            </Link>
          </div>
          {stats.counts.total === 0 ? (
            <p className="text-sm text-ink-2">
              Once your predictions resolve, this is where you&apos;ll see whether your 70%s happen 70% of the time.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.binary && (
                <>
                  <CalibrationChart bins={stats.binary.bins} mini />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-ink-3">Brier score</div>
                      <div className="text-lg font-semibold text-ink">{stats.binary.brier.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-ink-3">Verdict</div>
                      <div className="font-medium leading-tight text-ink">{VERDICT_COPY[confidenceVerdict(stats.binary.fit)].short}</div>
                    </div>
                  </div>
                </>
              )}
              {stats.continuous && (
                <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                  <div>
                    <div className="text-ink-3">Ranges caught truth</div>
                    <div className="text-lg font-semibold text-ink">
                      {pct(stats.continuous.hitRate)} <span className="text-sm font-normal text-ink-3">/ {pct(stats.continuous.targetRate)}</span>
                    </div>
                  </div>
                  {stats.byType.duration?.multiplier != null && (
                    <div>
                      <div className="text-ink-3">Tasks take</div>
                      <div className="text-lg font-semibold text-ink">
                        {fmtRatio(stats.byType.duration.multiplier)} <span className="text-sm font-normal text-ink-3">your guess</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent-soft p-2 text-accent-ink">
              <Dumbbell size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-ink">Calibration drill</h2>
              <p className="mt-0.5 text-sm text-ink-2">
                10 quick trivia estimates with instant feedback. Real predictions take weeks to resolve; drills take two minutes.
              </p>
              {drills.total > 0 && (
                <p className="mt-2 text-sm text-ink-3">
                  {drills.total} answered · {drills.intervalN > 0 ? `${pct(drills.intervalHitRate)} of ranges caught the answer` : ""}
                </p>
              )}
              <ButtonLink href="/drills" size="sm" variant="secondary" className="mt-3">
                Start a round <ArrowRight size={14} />
              </ButtonLink>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Groups</h2>
            <Link href="/groups" className="text-sm font-medium text-accent-ink hover:underline">
              Manage →
            </Link>
          </div>
          {composer.groups.length ? (
            <ul className="space-y-1">
              {composer.groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/groups/${g.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
                    <Users size={14} /> {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">
              Calibration is more fun with friends.{" "}
              <Link href="/groups" className="font-medium text-accent-ink hover:underline">
                Start a group
              </Link>{" "}
              and send the invite link.
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}
