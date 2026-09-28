import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getUserGroups } from "@/lib/data/groups";

export const metadata: Metadata = { title: "Groups" };

export default async function GroupsPage({ searchParams }: PageProps<"/groups">) {
  const user = await requireUser();
  const invalid = (await searchParams).invalid;
  const groups = await getUserGroups(user.id);
  return (
    <div>
      <PageHeader title="Groups" subtitle="Forecast together: share questions, see each other's calibration, compare on the same questions." />
      {invalid && <p className="mb-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad-ink">That invite link isn&apos;t valid anymore — ask for a fresh one.</p>}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {groups.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/groups/${g.id}`} className="block rounded-2xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong">
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <Users size={16} className="text-ink-3" /> {g.name}
                    </div>
                    {g.description && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{g.description}</p>}
                    <p className="mt-3 text-xs text-ink-3">
                      {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                      {g.role === "owner" && " · you own this"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="You're not in any groups yet">
              Create one and send your friends the invite link. Everyone can forecast on each other&apos;s questions, and the group gets a
              leaderboard of shared questions.
            </EmptyState>
          )}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-3 font-semibold text-ink">Start a group</h2>
          <CreateGroupForm />
        </Card>
      </div>
    </div>
  );
}
