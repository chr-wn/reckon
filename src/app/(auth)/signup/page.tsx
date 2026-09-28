import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { db, groups } from "@/lib/db";

export async function generateMetadata({ searchParams }: PageProps<"/signup">): Promise<Metadata> {
  const invite = (await searchParams).invite;
  const [group] =
    typeof invite === "string" ? await db.select({ name: groups.name }).from(groups).where(eq(groups.inviteCode, invite)).limit(1) : [];
  if (!group) return { title: "Sign up" };
  const title = `Join ${group.name}`;
  const description = "You've been invited to make predictions together and see who's best calibrated.";
  return { title, description, openGraph: { title: `${title} on Reckon`, description } };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const invite = typeof sp.invite === "string" ? sp.invite : undefined;
  if (await getCurrentUser()) redirect(invite ? `/invite/${encodeURIComponent(invite)}` : "/");
  const [group] = invite ? await db.select({ name: groups.name }).from(groups).where(eq(groups.inviteCode, invite)).limit(1) : [];
  return (
    <Card className="p-6 sm:p-7">
      <h1 className="mb-1 font-serif text-3xl text-ink">{group ? `Join ${group.name}` : "Create an account"}</h1>
      <p className="mb-6 text-sm text-ink-2">
        {group
          ? "You've been invited to forecast together. Make an account and you're in."
          : "Predict things, find out how calibrated you really are, get better."}
      </p>
      <AuthForm mode="signup" invite={group ? invite : undefined} requireCode={!!process.env.SIGNUP_CODE && !group} />
    </Card>
  );
}
