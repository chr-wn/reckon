import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RangeFilter, parseRange } from "@/components/stats/range-filter";
import { StatsView } from "@/components/stats/stats-view";
import { Avatar } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getDrillAttempts, summarizeDrills } from "@/lib/data/drills";
import { shareAGroup } from "@/lib/data/groups";
import { getUserByUsername, loadUserRecords } from "@/lib/data/stats";
import { fmtDate } from "@/lib/format";
import { requestNow } from "@/lib/request-time";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  return { title: `@${(await params).username}` };
}

export default async function ProfilePage({ params, searchParams }: PageProps<"/u/[username]">) {
  const viewer = await requireUser();
  const target = await getUserByUsername((await params).username);
  // Profiles are visible to yourself and people you share a group with.
  if (!target || !(await shareAGroup(viewer.id, target.id))) notFound();
  const self = target.id === viewer.id;
  const range = parseRange((await searchParams).range);
  const since = range.days ? requestNow() - range.days * 864e5 : 0;
  const [records, attempts] = await Promise.all([loadUserRecords(target.id, viewer.id), getDrillAttempts(target.id)]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={target.displayName} size={56} />
        <div>
          <h1 className="font-serif text-[2.2rem] leading-tight text-ink">{target.displayName}</h1>
          <p className="text-sm text-ink-3">
            @{target.username} · forecasting since {fmtDate(target.createdAt, viewer.timezone, "dayYear")}
            {!self && " · stats from questions you can both see"}
          </p>
        </div>
      </div>
      <RangeFilter base={`/u/${target.username}`} active={range.key} />
      <StatsView
        tz={viewer.timezone}
        self={self}
        records={records.filter((r) => r.resolvedAt.getTime() >= since)}
        drills={summarizeDrills(attempts.filter((a) => a.createdAt.getTime() >= since))}
      />
    </div>
  );
}
