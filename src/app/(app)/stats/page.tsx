import type { Metadata } from "next";
import { RangeFilter, parseRange } from "@/components/stats/range-filter";
import { StatsView } from "@/components/stats/stats-view";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getDrillAttempts, summarizeDrills } from "@/lib/data/drills";
import { loadUserRecords } from "@/lib/data/stats";
import { requestNow } from "@/lib/request-time";

export const metadata: Metadata = { title: "Your stats" };

export default async function StatsPage({ searchParams }: PageProps<"/stats">) {
  const user = await requireUser();
  const range = parseRange((await searchParams).range);
  const since = range.days ? requestNow() - range.days * 864e5 : 0;
  const [records, attempts] = await Promise.all([loadUserRecords(user.id, user.id), getDrillAttempts(user.id)]);
  return (
    <div>
      <PageHeader title="Your calibration" subtitle="How well do your probabilities match reality — and is it getting better?" />
      <RangeFilter base="/stats" active={range.key} />
      <StatsView
        tz={user.timezone}
        self
        records={records.filter((r) => r.resolvedAt.getTime() >= since)}
        drills={summarizeDrills(attempts.filter((a) => a.createdAt.getTime() >= since))}
      />
    </div>
  );
}
