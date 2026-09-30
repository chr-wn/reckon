import { Lock } from "lucide-react";
import { ForecastSummary } from "@/components/questions/bits";
import { Avatar, Card } from "@/components/ui";
import type { CommentView, ForecastView, UserLite } from "@/lib/data/questions";
import type { Question } from "@/lib/db/schema";
import { fmtDate, fmtValue, relativeTime } from "@/lib/format";
import { CommentBox, DeleteCommentButton } from "./comment-box";

type Entry =
  | { kind: "forecast"; id: string; at: Date; user: UserLite; forecast: ForecastView; isUpdate: boolean }
  | { kind: "hidden"; id: string; at: Date; user: UserLite; isUpdate: boolean }
  | { kind: "comment"; id: string; at: Date; user: UserLite; body: string }
  | { kind: "resolution"; id: string; at: Date; user: UserLite };

type ActivityQuestion = Pick<Question, "id" | "type" | "unit" | "resolvedAt" | "resolution" | "resolutionValue"> & { author: UserLite };

/**
 * One chronological stream, like Fatebook's: every forecast (updates included),
 * comments, and the resolution. Others' forecasts show up as "hidden" stubs
 * until you've forecast, so the conversation still reads in order.
 */
export function Activity({
  q,
  forecasts,
  hiddenForecasts,
  comments,
  viewerId,
  tz,
  now,
}: {
  q: ActivityQuestion;
  forecasts: ForecastView[];
  hiddenForecasts: { id: string; createdAt: Date; user: UserLite }[];
  comments: CommentView[];
  viewerId: string;
  tz: string;
  now: number;
}) {
  const entries: Entry[] = [];
  const forecastsSoFar = new Map<string, number>();
  const chronological = [
    ...forecasts.map((f) => ({ id: f.id, at: f.createdAt, user: f.user, forecast: f as ForecastView | null })),
    ...hiddenForecasts.map((f) => ({ id: f.id, at: f.createdAt, user: f.user, forecast: null })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const f of chronological) {
    const count = forecastsSoFar.get(f.user.id) ?? 0;
    forecastsSoFar.set(f.user.id, count + 1);
    entries.push(
      f.forecast
        ? { kind: "forecast", id: f.id, at: f.at, user: f.user, forecast: f.forecast, isUpdate: count > 0 }
        : { kind: "hidden", id: f.id, at: f.at, user: f.user, isUpdate: count > 0 },
    );
  }
  for (const c of comments) entries.push({ kind: "comment", id: c.id, at: c.createdAt, user: c.user, body: c.body });
  if (q.resolvedAt) entries.push({ kind: "resolution", id: "resolution", at: q.resolvedAt, user: q.author });
  entries.sort((a, b) => a.at.getTime() - b.at.getTime());

  const resolutionLabel =
    q.resolution === "value" && q.resolutionValue != null
      ? `Resolved: ${fmtValue(q, q.resolutionValue, tz)}`
      : q.resolution === "ambiguous"
        ? "Resolved ambiguous"
        : `Resolved ${q.resolution?.toUpperCase()}`;

  return (
    <Card className="p-4 sm:p-5">
      {entries.length > 0 && (
        <ol className="mb-4 space-y-3.5">
          {entries.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="group flex gap-3 text-sm">
              <Avatar name={e.user.displayName} src={e.user.avatarUrl} size={26} className="mt-px" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-ink">{e.user.id === viewerId ? "You" : e.user.displayName}</span>
                  {e.kind === "forecast" && (
                    <span className="inline-flex items-baseline gap-1.5">
                      {e.isUpdate && <span className="text-ink-3">updated to</span>}
                      <ForecastSummary q={q} f={e.forecast} tz={tz} />
                    </span>
                  )}
                  {e.kind === "hidden" && (
                    <span className="inline-flex items-center gap-1 text-ink-3">
                      <Lock size={12} aria-hidden /> {e.isUpdate ? "updated their forecast" : "forecast"} · hidden until you forecast
                    </span>
                  )}
                  {e.kind === "resolution" && <span className="font-medium italic text-accent-ink">{resolutionLabel}</span>}
                  <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-ink-3">
                    {e.kind === "comment" && e.user.id === viewerId && <DeleteCommentButton id={e.id} />}
                    <time dateTime={e.at.toISOString()} title={fmtDate(e.at, tz, "dateTime")}>
                      {relativeTime(e.at, now)}
                    </time>
                  </span>
                </div>
                {e.kind === "comment" && <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink-2">{e.body}</p>}
                {e.kind === "forecast" && e.forecast.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-ink-2">{e.forecast.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <CommentBox questionId={q.id} />
    </Card>
  );
}
