import Link from "next/link";
import type { UserLite } from "@/lib/data/questions";
import { fmtRatio, pct } from "@/lib/format";
import { summarizeBinary } from "@/lib/scoring/binary";
import { summarizeContinuous } from "@/lib/scoring/continuous";
import { isBinary, isContinuous, relativeScores, type ScoredRecord } from "@/lib/scoring/records";
import { VERDICT_COPY } from "@/lib/verdicts";
import { Avatar, Card, cn } from "../ui";

/**
 * Everyone's record on resolved public predictions. "vs. friends" compares
 * each person to the median of everyone else on the *same* questions.
 */
export function Scoreboard({ users, records, viewerId, activeUsername }: { users: UserLite[]; records: ScoredRecord[]; viewerId: string; activeUsername?: string }) {
  const rel = relativeScores(records);
  const rows = users
    .map((u) => {
      const mine = records.filter((r) => r.userId === u.id);
      const bin = summarizeBinary(mine.filter(isBinary).flatMap((r) => r.points));
      const cont = summarizeContinuous(mine.filter(isContinuous).flatMap((r) => r.points));
      const dur = summarizeContinuous(
        mine
          .filter(isContinuous)
          .filter((r) => r.type === "duration")
          .flatMap((r) => r.points),
      );
      return { u, n: mine.length, bin, cont, dur, vs: rel.get(u.id)?.binary?.mean ?? null };
    })
    .sort((a, b) => (a.vs ?? 9) - (b.vs ?? 9) || b.n - a.n);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold text-ink">Scoreboard</h2>
        <span className="text-xs text-ink-3">public predictions</span>
      </div>
      <ul className="space-y-1">
        {rows.map(({ u, n, bin, cont, dur, vs }) => {
          const facts = [
            bin && `Brier ${bin.brier.toFixed(2)}`,
            bin && bin.verdict !== "not-enough-data" && VERDICT_COPY[bin.verdict].short.toLowerCase(),
            cont && `ranges ${pct(cont.hitRate)}/${pct(cont.targetRate)}`,
            dur?.multiplier != null && `tasks ${fmtRatio(dur.multiplier)}`,
          ].filter(Boolean);
          return (
            <li key={u.id}>
              <Link
                href={`/?who=${encodeURIComponent(u.id === viewerId ? "me" : u.username)}`}
                className={cn("flex gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2", activeUsername === u.username && "bg-surface-2")}
              >
                <Avatar name={u.displayName} src={u.avatarUrl} size={26} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{u.id === viewerId ? "You" : u.displayName}</span>
                    {vs != null && (
                      <span
                        className={cn("shrink-0 text-xs tnum", Math.abs(vs) < 0.005 ? "text-ink-3" : vs < 0 ? "text-good-ink" : "text-bad-ink")}
                        title="Brier vs. the median of everyone else on the same questions (negative is better)"
                      >
                        {Math.abs(vs) < 0.005 ? "±0.00" : `${vs < 0 ? "−" : "+"}${Math.abs(vs).toFixed(2)}`}
                      </span>
                    )}
                  </div>
                  <div className="text-xs leading-snug text-ink-3">{n ? `${n} resolved · ${facts.join(" · ")}` : "nothing resolved yet"}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-3">
        Brier: 0 is perfect, 0.25 = always saying 50%. The ± number compares each person with everyone else on the same questions.{" "}
        <Link href="/stats" className="text-accent-ink hover:underline">
          Full stats →
        </Link>
      </p>
    </Card>
  );
}
