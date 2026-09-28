import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TimezoneInput } from "@/components/timezone-input";
import { Card, ErrorText } from "@/components/ui";
import { safeNext } from "@/lib/auth/accounts";
import { googleConfigured } from "@/lib/auth/google";
import { getCurrentUser } from "@/lib/auth/session";
import { db, users } from "@/lib/db";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  code: "New here? Enter the signup code, then continue with Google.",
  denied: "Google sign-in was cancelled.",
  expired: "That sign-in took too long or was interrupted. Try again.",
  failed: "Couldn't sign in with Google. Try again.",
  config: "Google sign-in isn't set up yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const needsCode = !!process.env.SIGNUP_CODE;
  const dev = process.env.NODE_ENV !== "production";
  const devUsers = dev ? await db.select({ username: users.username, displayName: users.displayName }).from(users).limit(8) : [];

  return (
    <Card className="p-6 sm:p-7">
      <h1 className="font-serif text-3xl text-ink">Predict things. Keep score.</h1>
      <p className="mt-1.5 mb-6 text-sm leading-relaxed text-ink-2">
        A shared stream of predictions for friends — and an honest record of how often your 80%s come true.
      </p>
      <form action="/auth/google" method="post" className="space-y-4">
        <TimezoneInput />
        <input type="hidden" name="next" value={next} />
        {needsCode && (
          <div>
            <label htmlFor="signupCode" className="mb-1.5 block text-sm font-medium text-ink-2">
              Signup code <span className="font-normal text-ink-3">(first time only)</span>
            </label>
            <input id="signupCode" name="signupCode" className="field" autoComplete="off" spellCheck={false} />
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-surface text-[0.9375rem] font-medium text-ink transition-colors hover:bg-surface-2"
        >
          <GoogleIcon /> Continue with Google
        </button>
      </form>
      {dev && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="mb-2 text-xs text-ink-3">
            Local dev only{googleConfigured() ? "" : " (Google isn't configured)"} — sign in as:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {devUsers.map((u) => (
              <Link key={u.username} href={`/auth/dev?u=${encodeURIComponent(u.username)}`} prefetch={false} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-2 hover:text-ink">
                {u.displayName}
              </Link>
            ))}
            {!devUsers.length && <span className="text-xs text-ink-3">no users yet — run npm run db:seed</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
