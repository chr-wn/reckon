import type { Metadata } from "next";
import Link from "next/link";
import { RangeFilter, parseRange } from "@/components/stats/range-filter";
import { StatsView } from "@/components/stats/stats-view";
import { Avatar, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { listUsers } from "@/lib/data/questions";
import { loadUserRecords } from "@/lib/data/stats";
import { requestNow } from "@/lib/request-time";

export const metadata: Metadata = { title: "Stats" };

export default async function StatsPage({ searchParams }: PageProps<"/stats">) {
  const viewer = await requireUser();
  const sp = await searchParams;
  const people = await listUsers();
  const target = people.find((p) => p.username === sp.user) ?? people.find((p) => p.id === viewer.id)!;
  const self = target.id === viewer.id;
  const range = parseRange(sp.range);
  const since = range.days ? requestNow() - range.days * 864e5 : 0;
  const records = (await loadUserRecords(target.id, viewer.id)).filter((r) => r.resolvedAt.getTime() >= since);
  const userParam: Record<string, string> = self ? {} : { user: target.username };
  const personHref = (username: string, isSelf: boolean) => {
    const qs = new URLSearchParams({ ...(isSelf ? {} : { user: username }), ...(range.key === "all" ? {} : { range: range.key }) }).toString();
    return qs ? `/stats?${qs}` : "/stats";
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-[2.4rem] leading-[1.05] tracking-[-0.01em] text-ink">{self ? "Your calibration" : `${target.displayName}'s calibration`}</h1>
        <p className="mt-1.5 text-ink-2">
          {self ? "How well your probabilities match reality — and whether it's getting better." : "From their public predictions."}
        </p>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {people.map((p) => {
            const isSelf = p.id === viewer.id;
            return (
              <Link
                key={p.id}
                href={personHref(p.username, isSelf)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-colors",
                  p.id === target.id ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Avatar name={p.displayName} src={p.avatarUrl} size={22} />
                {isSelf ? "You" : p.displayName.split(" ")[0]}
              </Link>
            );
          })}
        </div>
        <RangeFilter base="/stats" active={range.key} params={userParam} />
      </div>
      <StatsView self={self} records={records} tz={viewer.timezone} />
    </div>
  );
}
