import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const invite = typeof sp.invite === "string" ? sp.invite : undefined;
  const next = invite ? `/invite/${encodeURIComponent(invite)}` : typeof sp.next === "string" ? sp.next : undefined;
  if (await getCurrentUser()) redirect(next ?? "/");
  return (
    <Card className="p-6 sm:p-7">
      <h1 className="mb-1 font-serif text-3xl text-ink">Welcome back</h1>
      <p className="mb-6 text-sm text-ink-2">Your predictions missed you.</p>
      <AuthForm mode="login" next={next} invite={invite} />
    </Card>
  );
}
