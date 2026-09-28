import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InviteBox } from "@/components/groups/invite-box";
import { LeaveGroupButton, RemoveMemberButton } from "@/components/groups/member-actions";
import { QuestionList } from "@/components/questions/question-list";
import { Avatar, Badge, ButtonLink, Card, cn, EmptyState, SectionHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getDrillAttemptsForUsers, summarizeDrills } from "@/lib/data/drills";
import { getGroupForMember } from "@/lib/data/groups";
import { listQuestions } from "@/lib/data/questions";
import { loadGroupRecords } from "@/lib/data/stats";
import { fmtRatio, pct } from "@/lib/format";
import { requestNow } from "@/lib/request-time";
import { summarizeBinary } from "@/lib/scoring/binary";
import { summarizeContinuous } from "@/lib/scoring/continuous";
import { isBinary, isContinuous, relativeScores } from "@/lib/scoring/records";
import { VERDICT_COPY } from "@/lib/verdicts";

export async function generateMetadata({ params }: PageProps<"/groups/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const g = await getGroupForMember((await params).id, user.id);
  return { title: g?.group.name ?? "Group" };
}

const TABS = [
  { key: "questions", label: "Questions" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "members", label: "Members" },
] as const;

export default async function GroupPage({ params, searchParams }: PageProps<"/groups/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const data = await getGroupForMember(id, user.id);
  if (!data) notFound();
  const { group, role, members } = data;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "questions";
  const isOwner = role === "owner";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[2.4rem] leading-[1.05] text-ink">{group.name}</h1>
          {group.description && <p className="mt-1.5 text-ink-2">{group.description}</p>}
          <div className="mt-3 flex -space-x-1.5">
            {members.slice(0, 12).map((m) => (
              <Link key={m.id} href={`/u/${m.username}`} title={m.displayName} className="rounded-full ring-2 ring-bg">
                <Avatar name={m.displayName} size={28} />
              </Link>
            ))}
          </div>
        </div>
        <ButtonLink href={`/new?group=${group.id}`}>
          <Plus size={16} strokeWidth={2.5} /> Ask the group
        </ButtonLink>
      </div>

      {(sp.welcome || sp.created) && (
        <Card className="mb-6 p-5">
          <div className="font-semibold text-ink">{sp.created ? "Group created 🎉 Now invite your friends:" : `Welcome to ${group.name}!`}</div>
          {sp.created ? (
            <div className="mt-3">
              <InviteBox groupId={group.id} code={group.inviteCode} isOwner={isOwner} />
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-2">
              Forecast on the open questions below — others&apos; numbers stay hidden until you&apos;ve made yours.
            </p>
          )}
        </Card>
      )}

      <nav className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "questions" ? `/groups/${group.id}` : `/groups/${group.id}?tab=${t.key}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "questions" && <GroupQuestions groupId={group.id} userId={user.id} tz={user.timezone} />}
      {tab === "leaderboard" && <Leaderboard groupId={group.id} members={members} viewerId={user.id} />}
      {tab === "members" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="divide-y divide-line p-0">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.displayName} size={32} />
                <Link href={`/u/${m.username}`} className="min-w-0 flex-1 hover:underline">
                  <div className="truncate font-medium text-ink">{m.displayName}</div>
                  <div className="truncate text-xs text-ink-3">@{m.username}</div>
                </Link>
                {m.role === "owner" && <Badge>owner</Badge>}
                {isOwner && m.id !== user.id && <RemoveMemberButton groupId={group.id} userId={m.id} name={m.displayName} />}
              </div>
            ))}
          </Card>
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-ink">Invite link</h2>
              <InviteBox groupId={group.id} code={group.inviteCode} isOwner={isOwner} />
            </Card>
            <LeaveGroupButton groupId={group.id} />
          </div>
        </div>
      )}
    </div>
  );
}

async function GroupQuestions({ groupId, userId, tz }: { groupId: string; userId: string; tz: string }) {
  const [open, resolved] = await Promise.all([
    listQuestions(userId, { groupId, status: "open" }),
    listQuestions(userId, { groupId, status: "resolved" }),
  ]);
  const now = requestNow();
  const waiting = open.filter((q) => !q.myForecast);
  const rest = open.filter((q) => q.myForecast);
  return (
    <div className="space-y-8">
      {waiting.length > 0 && (
        <section>
          <SectionHeader title="Needs your forecast" subtitle="Commit before you peek." />
          <QuestionList rows={waiting} viewerId={userId} tz={tz} now={now} />
        </section>
      )}
      {rest.length > 0 ? (
        <section>
          <SectionHeader title="Open" subtitle="You've forecast these" />
          <QuestionList rows={rest} viewerId={userId} tz={tz} now={now} />
        </section>
      ) : (
        !waiting.length && <EmptyState title="No open questions">Ask the group something that resolves this week.</EmptyState>
      )}
      {resolved.length > 0 && (
        <section>
          <SectionHeader title="Resolved" />
          <QuestionList rows={resolved.slice(0, 30)} viewerId={userId} tz={tz} now={now} />
        </section>
      )}
    </div>
  );
}

function Rel({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="text-ink-3">–</span>;
  return <span className={v <= 0 ? "text-good-ink" : "text-bad-ink"}>{`${v <= 0 ? "−" : "+"}${Math.abs(v).toFixed(3)}`}</span>;
}

async function Leaderboard({
  groupId,
  members,
  viewerId,
}: {
  groupId: string;
  members: { id: string; username: string; displayName: string }[];
  viewerId: string;
}) {
  const [records, drillMap] = await Promise.all([loadGroupRecords(groupId), getDrillAttemptsForUsers(members.map((m) => m.id))]);
  const rel = relativeScores(records);
  const rows = members.map((m) => {
    const mine = records.filter((r) => r.userId === m.id);
    const bin = mine.filter(isBinary);
    const cont = mine.filter(isContinuous);
    const durations = cont.filter((r) => r.type === "duration");
    return {
      m,
      bin: summarizeBinary(bin.flatMap((r) => r.points)),
      binN: bin.length,
      cont: summarizeContinuous(cont.flatMap((r) => r.points)),
      contN: cont.length,
      dur: summarizeContinuous(durations.flatMap((r) => r.points)),
      rel: rel.get(m.id),
      drills: summarizeDrills(drillMap.get(m.id) ?? []),
    };
  });
  const nameCell = (m: { id: string; username: string; displayName: string }) => (
    <Link href={`/u/${m.username}`} className="flex items-center gap-2 font-medium text-ink hover:underline">
      <Avatar name={m.displayName} size={24} />
      {m.id === viewerId ? "You" : m.displayName}
    </Link>
  );
  const th = "px-4 py-2 font-medium";
  const td = "px-4 py-2.5 text-ink-2";
  const sortKey = (v: number | null | undefined, fallback: number | null | undefined) => v ?? (fallback != null ? fallback + 10 : 99);

  const binRows = rows.filter((r) => r.binN > 0).sort((a, b) => sortKey(a.rel?.binary?.mean, a.bin?.brier) - sortKey(b.rel?.binary?.mean, b.bin?.brier));
  const contRows = rows.filter((r) => r.contN > 0).sort((a, b) => sortKey(a.rel?.continuous?.mean, null) - sortKey(b.rel?.continuous?.mean, null));
  const drillRows = rows.filter((r) => r.drills.total > 0).sort((a, b) => Math.abs(a.drills.intervalHitRate - 0.8) - Math.abs(b.drills.intervalHitRate - 0.8));

  if (!records.length && !drillRows.length) {
    return <EmptyState title="No resolved group questions yet">The leaderboard fills in as questions shared with the group resolve.</EmptyState>;
  }
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-ink-2">
        <b className="text-ink">vs. group</b> compares each person to the median of everyone else on the <i>same</i> questions — the fairest
        comparison, since people ask questions of different difficulty. Negative is better. Only questions shared with this group count.
      </p>
      {binRows.length > 0 && (
        <section>
          <SectionHeader title="Yes / no questions" />
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm tnum">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className={th}>Member</th>
                  <th className={th}>Resolved</th>
                  <th className={th}>Brier</th>
                  <th className={th}>vs. group</th>
                  <th className={th}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {binRows.map((r) => (
                  <tr key={r.m.id} className="border-b border-line/60 last:border-0">
                    <td className={td}>{nameCell(r.m)}</td>
                    <td className={td}>{r.binN}</td>
                    <td className={td}>{r.bin?.brier.toFixed(3) ?? "–"}</td>
                    <td className={td}>
                      <Rel v={r.rel?.binary?.mean} />
                      {r.rel?.binary && <span className="ml-1 text-xs text-ink-3">({r.rel.binary.n})</span>}
                    </td>
                    <td className={td}>{r.bin ? VERDICT_COPY[r.bin.verdict].short : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
      {contRows.length > 0 && (
        <section>
          <SectionHeader title="Ranges" />
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm tnum">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className={th}>Member</th>
                  <th className={th}>Resolved</th>
                  <th className={th}>Caught</th>
                  <th className={th}>Tasks take</th>
                  <th className={th}>vs. group</th>
                </tr>
              </thead>
              <tbody>
                {contRows.map((r) => (
                  <tr key={r.m.id} className="border-b border-line/60 last:border-0">
                    <td className={td}>{nameCell(r.m)}</td>
                    <td className={td}>{r.contN}</td>
                    <td className={td}>{r.cont ? `${pct(r.cont.hitRate)} / ${pct(r.cont.targetRate)}` : "–"}</td>
                    <td className={td}>{r.dur?.multiplier != null ? fmtRatio(r.dur.multiplier) : "–"}</td>
                    <td className={td}>
                      <Rel v={r.rel?.continuous?.mean} />
                      {r.rel?.continuous && <span className="ml-1 text-xs text-ink-3">({r.rel.continuous.n})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-2 text-xs text-ink-3">
            &ldquo;vs. group&rdquo; for ranges uses the interval score (width + penalty for misses), scaled by the others&apos; typical range width.
          </p>
        </section>
      )}
      {drillRows.length > 0 && (
        <section>
          <SectionHeader title="Drills" subtitle="Everyone answers the same trivia, so this one's apples to apples" />
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm tnum">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className={th}>Member</th>
                  <th className={th}>Answered</th>
                  <th className={th}>Ranges caught</th>
                  <th className={th}>Comparison Brier</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map((r) => (
                  <tr key={r.m.id} className="border-b border-line/60 last:border-0">
                    <td className={td}>{nameCell(r.m)}</td>
                    <td className={td}>{r.drills.total}</td>
                    <td className={td}>{r.drills.intervalN ? `${pct(r.drills.intervalHitRate)} (target 80%)` : "–"}</td>
                    <td className={td}>{r.drills.compare ? r.drills.compare.brier.toFixed(3) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}
