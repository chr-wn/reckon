import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { signInWithGoogle } from "@/lib/auth/accounts";
import { callbackUrl, exchangeCode, OAUTH_COOKIE } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";

interface Pending {
  state: string;
  verifier: string;
  next: string;
  tz: string;
  signupCode: string;
}

export async function GET(req: NextRequest) {
  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  store.delete({ name: OAUTH_COOKIE, path: "/auth/google" });
  const params = req.nextUrl.searchParams;
  if (params.get("error")) redirect("/login?error=denied");

  let pending: Pending | null = null;
  try {
    pending = raw ? (JSON.parse(raw) as Pending) : null;
  } catch {}
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) redirect("/login?error=expired");

  let result: Awaited<ReturnType<typeof signInWithGoogle>>;
  try {
    const profile = await exchangeCode({ code, verifier: pending.verifier, redirectUri: callbackUrl(req.nextUrl.origin) });
    result = await signInWithGoogle(profile, { timezone: pending.tz, signupCode: pending.signupCode });
  } catch (err) {
    console.error("Google sign-in failed:", err);
    redirect("/login?error=failed");
  }
  if (!result.ok) redirect("/login?error=code");
  await createSession(result.userId);
  redirect(pending.next);
}
