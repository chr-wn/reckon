import Link from "next/link";
import { QuestionComposer } from "@/components/composer/question-composer";
import { QuestionList } from "@/components/questions/question-list";
import { QuickResolve } from "@/components/questions/quick-resolve";
import { TimerCard } from "@/components/questions/timer-card";
import { Scoreboard } from "@/components/stream/scoreboard";
import { StreamSelect } from "@/components/stream/stream-select";
import { cn, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getTrackRecord } from "@/lib/data/composer";
import { defaultSort, listInProgress, listStream, listUsers, SORTS, STATUSES, type StreamSort, type StreamStatus } from "@/lib/data/questions";
import { loadPublicRecords } from "@/lib/data/stats";
import { requestNow } from "@/lib/request-time";

const STATUS_LABELS: Record<StreamStatus, string> = { open: "Open", resolve: "Needs resolving", resolved: "Resolved", all: "All" };
const SORT_LABELS: Record<StreamSort, string> = { new: "Newest", closing: "Closing soonest", resolved: "Recently resolved" };

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = requestNow();
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const status = (STATUSES as readonly string[]).includes(str("status") ?? "") ? (str("status") as StreamStatus) : "open";
  const sort = (SORTS as readonly string[]).includes(str("sort") ?? "") ? (str("sort") as StreamSort) : defaultSort(status);
  const people = await listUsers();
  const who = str("who") ?? "all";
  const author = who === "me" ? people.find((p) => p.id === user.id) : people.find((p) => p.username === who);

  const [rows, inProgress, { track }, publicRecords] = await Promise.all([
    listStream(user.id, { status, sort, authorId: author?.id }, now),
    listInProgress(user.id, now),
    getTrackRecord(user.id),
    loadPublicRecords(),
  ]);

  // Current params (minus defaults), for building filter links.
  const params: Record<string, string> = {};
  if (status !== "open") params.status = status;
  if (author) params.who = who;
  if (sort !== defaultSort(status)) params.sort = sort;
  const statusHref = (s: StreamStatus) => {
    const next = new URLSearchParams({ ...params, status: s });
    if (s === "open") next.delete("status");
    next.delete("sort");
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        {inProgress.map((q) => (
          <TimerCard
            key={q.id}
            serverNow={now}
            t={{
              id: q.id,
              title: q.title,
              runningSince: q.timerRunningSince?.getTime() ?? null,
              accumulatedMs: q.timerAccumulatedMs,
              median: q.myForecast?.median ?? null,
              low: q.myForecast?.low ?? null,
              high: q.myForecast?.high ?? null,
            }}
          />
        ))}

        <QuestionComposer track={track} tz={user.timezone} placeholderIndex={Math.floor(now / 36e5)} />

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={statusHref(s)}
                scroll={false}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  status === s ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <StreamSelect
              name="who"
              label="Whose predictions"
              value={author ? who : "all"}
              params={params}
              options={[
                { value: "all", label: "Everyone" },
                { value: "me", label: "Me" },
                ...people.filter((p) => p.id !== user.id).map((p) => ({ value: p.username, label: p.displayName })),
              ]}
            />
            <StreamSelect
              name="sort"
              label="Sort"
              value={sort}
              params={params}
              options={[defaultSort(status), ...SORTS.filter((s) => s !== defaultSort(status))].map((s) => ({ value: s, label: SORT_LABELS[s] }))}
            />
          </div>
        </div>

        {rows.length ? (
          <QuestionList
            rows={rows}
            viewerId={user.id}
            tz={user.timezone}
            now={now}
            trailing={(q) =>
              q.authorId === user.id && !q.resolvedAt && !q.workStartedAt && q.closesAt && q.closesAt.getTime() < now ? (
                <QuickResolve id={q.id} type={q.type} />
              ) : null
            }
          />
        ) : (
          <EmptyState title={status === "resolve" ? "Nothing waiting to be resolved" : "Nothing here yet"}>
            {author || status !== "open" ? "Try another filter." : "Post the first prediction above."}
          </EmptyState>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Scoreboard users={people} records={publicRecords} viewerId={user.id} activeUsername={author?.username} />
      </aside>
    </div>
  );
}
