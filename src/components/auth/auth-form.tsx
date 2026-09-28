"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/lib/actions/auth";
import { Button, ErrorText, Label } from "@/components/ui";
import { TimezoneInput } from "./timezone-input";

export function AuthForm({
  mode,
  next,
  invite,
  requireCode,
}: {
  mode: "login" | "signup";
  next?: string;
  invite?: string;
  requireCode?: boolean;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, {});
  const qs = new URLSearchParams();
  if (next) qs.set("next", next);
  if (invite) qs.set("invite", invite);
  const suffix = qs.size ? `?${qs}` : "";

  return (
    <form action={action} className="space-y-4">
      <TimezoneInput />
      {next && <input type="hidden" name="next" value={next} />}
      {invite && <input type="hidden" name="invite" value={invite} />}
      <div>
        <Label htmlFor="username">Username</Label>
        <input
          id="username"
          name="username"
          className="field"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.values?.username}
          required
          autoFocus
        />
      </div>
      {mode === "signup" && (
        <div>
          <Label htmlFor="displayName">
            Display name <span className="font-normal text-ink-3">(optional)</span>
          </Label>
          <input id="displayName" name="displayName" className="field" autoComplete="name" defaultValue={state.values?.displayName} />
        </div>
      )}
      <div>
        <Label htmlFor="password">Password</Label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
        />
      </div>
      {mode === "signup" && requireCode && (
        <div>
          <Label htmlFor="signupCode">Signup code</Label>
          <input id="signupCode" name="signupCode" className="field" autoComplete="off" required />
          <p className="mt-1 text-xs text-ink-3">Ask whoever runs this site, or use a group invite link.</p>
        </div>
      )}
      <ErrorText>{state.error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "One sec…" : mode === "login" ? "Log in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-ink-2">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href={`/signup${suffix}`} className="font-medium text-accent-ink hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login${suffix}`} className="font-medium text-accent-ink hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
