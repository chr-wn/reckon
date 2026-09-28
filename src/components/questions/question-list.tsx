import { ArrowRight, Lock, Users } from "lucide-react";
import Link from "next/link";
import type { QuestionRow } from "@/lib/data/questions";
import { fmtDate, relativeTime } from "@/lib/format";
import { cn } from "../ui";
import { ForecastSummary, OutcomeBadge, RecordBadge, TypeIcon } from "./bits";

export function QuestionList({
  rows,
  viewerId,
  tz,
  now,
  showAuthor = true,
  trailing,
}: {
  rows: QuestionRow[];
  viewerId: string;
  tz: string;
  now: number;
  showAuthor?: boolean;
  /** Extra per-row controls (e.g. quick resolve buttons) */
  trailing?: (row: QuestionRow) => React.ReactNode;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {rows.map((q) => (
        <QuestionListItem key={q.id} q={q} viewerId={viewerId} tz={tz} now={now} showAuthor={showAuthor} trailing={trailing?.(q)} />
      ))}
    </ul>
  );
}

function statusText(q: QuestionRow, now: number, tz: string): { text: string; urgent?: boolean } | null {
  if (q.resolvedAt) return { text: `resolved ${relativeTime(q.resolvedAt, now)}` };
  if (q.workStartedAt) return { text: "in progress" };
  if (q.closesAt) {
    const t = q.closesAt.getTime();
    if (t < now) return { text: `was due ${fmtDate(q.closesAt, tz, "monthDay")}`, urgent: true };
    return { text: `closes ${relativeTime(t, now)}` };
  }
  return null;
}

export function QuestionListItem({
  q,
  viewerId,
  tz,
  now,
  showAuthor,
  trailing,
}: {
  q: QuestionRow;
  viewerId: string;
  tz: string;
  now: number;
  showAuthor: boolean;
  trailing?: React.ReactNode;
}) {
  const mine = q.authorId === viewerId;
  const status = statusText(q, now, tz);
  const others = q.forecasterCount - (q.myForecast ? 1 : 0);
  return (
    <li className="group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50 sm:px-5">
      <TypeIcon type={q.type} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <Link href={`/q/${q.id}`} className="font-medium leading-snug text-ink after:absolute after:inset-0 after:content-['']">
          {q.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-3">
          {showAuthor && !mine && <span className="text-ink-2">{q.author.displayName}</span>}
          {status && <span className={cn(status.urgent && "font-medium text-bad-ink")}>{status.text}</span>}
          {others > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users size={12} /> {others}
            </span>
          )}
          {mine && q.forecasterCount <= 1 && !q.resolvedAt && <Lock size={12} aria-label="Only you so far" />}
          {q.tags.slice(0, 3).map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 flex-col items-end gap-1.5 text-right text-sm">
        {q.resolvedAt ? (
          <>
            <OutcomeBadge q={q} tz={tz} />
            {q.myRecord && <RecordBadge r={q.myRecord} />}
          </>
        ) : q.myForecast ? (
          <ForecastSummary q={q} f={q.myForecast} tz={tz} />
        ) : (
          <Link href={`/q/${q.id}`} className="inline-flex items-center gap-1 font-medium text-accent-ink">
            Forecast <ArrowRight size={14} />
          </Link>
        )}
        {trailing}
      </div>
    </li>
  );
}
