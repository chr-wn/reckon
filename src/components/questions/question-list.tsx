import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import type { QuestionRow } from "@/lib/data/questions";
import { fmtDate, fmtValue, pct, relativeTime } from "@/lib/format";
import { Avatar, cn } from "../ui";
import { ForecastSummary, OutcomeBadge, RecordBadge, TypeIcon } from "./bits";

export function QuestionList({
  rows,
  viewerId,
  tz,
  now,
  trailing,
}: {
  rows: QuestionRow[];
  viewerId: string;
  tz: string;
  now: number;
  /** Extra per-row controls (e.g. quick resolve buttons) */
  trailing?: (row: QuestionRow) => React.ReactNode;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {rows.map((q) => (
        <QuestionListItem key={q.id} q={q} viewerId={viewerId} tz={tz} now={now} trailing={trailing?.(q)} />
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
  return { text: `posted ${relativeTime(q.createdAt, now)}` };
}

function OthersSummary({ q, tz }: { q: QuestionRow; tz: string }) {
  if (!q.others) return null;
  const value = q.type === "binary" ? (q.others.probability != null ? pct(q.others.probability) : null) : q.others.median != null ? fmtValue(q, q.others.median, tz) : null;
  if (!value) return null;
  return (
    <span className="text-xs text-ink-3 tnum">
      {q.others.count === 1 ? "1 friend" : `${q.others.count} friends`}: <span className="font-medium text-ink-2">{value}</span>
    </span>
  );
}

export function QuestionListItem({ q, viewerId, tz, now, trailing }: { q: QuestionRow; viewerId: string; tz: string; now: number; trailing?: React.ReactNode }) {
  const mine = q.authorId === viewerId;
  const status = statusText(q, now, tz);
  const hiddenOthers = !q.others && q.forecasterCount - (q.myForecast ? 1 : 0);
  return (
    <li className="relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50 sm:px-5">
      <Avatar name={q.author.displayName} src={q.author.avatarUrl} size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <Link href={`/q/${q.id}`} className="font-medium leading-snug text-ink after:absolute after:inset-0 after:content-['']">
          {q.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-3">
          <span className="text-ink-2">{mine ? "You" : q.author.displayName}</span>
          <TypeIcon type={q.type} size={13} />
          {status && <span className={cn(status.urgent && "font-medium text-bad-ink")}>{status.text}</span>}
          {q.visibility === "private" && (
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> only you
            </span>
          )}
          {hiddenOthers ? <span>{hiddenOthers === 1 ? "1 forecast hidden" : `${hiddenOthers} forecasts hidden`} until you forecast</span> : null}
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 flex-col items-end gap-1 text-right text-sm">
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
        {!q.resolvedAt && <OthersSummary q={q} tz={tz} />}
        {trailing}
      </div>
    </li>
  );
}
