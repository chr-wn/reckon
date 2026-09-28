import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, ButtonLink, Card } from "@/components/ui";
import { joinGroup } from "@/lib/actions/groups";
import { getCurrentUser } from "@/lib/auth/session";
import { getGroupByInvite, getGroupForMember } from "@/lib/data/groups";

export const metadata: Metadata = { title: "Join group" };

export default async function InvitePage({ params }: PageProps<"/invite/[code]">) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signup?invite=${encodeURIComponent(code)}`);
  const group = await getGroupByInvite(code);
  if (!group) redirect("/groups?invalid=1");
  if (await getGroupForMember(group.id, user.id)) redirect(`/groups/${group.id}`);
  return (
    <div className="mx-auto max-w-md pt-6">
      <Card className="p-6 text-center">
        <p className="text-sm text-ink-3">You&apos;ve been invited to</p>
        <h1 className="mt-1 font-serif text-4xl text-ink">{group.name}</h1>
        {group.description && <p className="mt-2 text-ink-2">{group.description}</p>}
        <p className="mt-3 text-sm text-ink-3">
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        </p>
        <form action={joinGroup.bind(null, code)} className="mt-6 flex justify-center gap-2">
          <ButtonLink href="/" variant="ghost">
            Not now
          </ButtonLink>
          <Button type="submit">Join group</Button>
        </form>
      </Card>
    </div>
  );
}
