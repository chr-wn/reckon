import "server-only";
import { eq, like } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { isValidTimeZone } from "@/lib/format";
import type { GoogleProfile } from "./google";

export type SignInResult = { ok: true; userId: string } | { ok: false; reason: "signup-code" };

/** A readable, unique handle from the email ("charlie.w@…" → "charliew", then "charliew2"…). */
async function uniqueUsername(profile: GoogleProfile): Promise<string> {
  const source = profile.email?.split("@")[0] ?? profile.name ?? "friend";
  const base =
    source
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 20) || "friend";
  const padded = base.length >= 3 ? base : `${base}${"x".repeat(3 - base.length)}`;
  const taken = new Set((await db.select({ u: users.username }).from(users).where(like(users.username, `${padded}%`))).map((r) => r.u));
  if (!taken.has(padded)) return padded;
  for (let i = 2; ; i++) if (!taken.has(`${padded}${i}`)) return `${padded}${i}`;
}

/**
 * Returning Google users are signed straight in. New accounts need the
 * SIGNUP_CODE (when one is configured) so strangers can't join.
 */
export async function signInWithGoogle(profile: GoogleProfile, opts: { timezone?: string; signupCode?: string }): Promise<SignInResult> {
  const timezone = opts.timezone && isValidTimeZone(opts.timezone) ? opts.timezone : undefined;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.googleSub, profile.sub)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ email: profile.email, avatarUrl: profile.picture, ...(timezone ? { timezone } : {}) })
      .where(eq(users.id, existing.id));
    return { ok: true, userId: existing.id };
  }

  const required = process.env.SIGNUP_CODE?.trim();
  if (required && opts.signupCode?.trim() !== required) return { ok: false, reason: "signup-code" };

  const username = await uniqueUsername(profile);
  const [created] = await db
    .insert(users)
    .values({
      username,
      displayName: (profile.name ?? username).slice(0, 40),
      googleSub: profile.sub,
      email: profile.email,
      avatarUrl: profile.picture,
      timezone: timezone ?? "UTC",
    })
    .returning({ id: users.id });
  return { ok: true, userId: created.id };
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: unknown): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}
