"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { db, groupMembers, groups, users } from "@/lib/db";
import { displayNameSchema, firstError, passwordSchema, timezoneSchema, usernameSchema } from "@/lib/validation";

export interface AuthState {
  error?: string;
  values?: { username?: string; displayName?: string };
}

/** Only allow same-site relative redirects. */
function safeNext(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = { username: str(formData.get("username")), displayName: str(formData.get("displayName")) };
  const parsed = z
    .object({ username: usernameSchema, displayName: z.string(), password: passwordSchema, timezone: timezoneSchema })
    .safeParse({ ...values, password: str(formData.get("password")), timezone: str(formData.get("timezone")) || undefined });
  if (!parsed.success) return { error: firstError(parsed.error), values };
  const { username, password, timezone } = parsed.data;
  const displayName = displayNameSchema.safeParse(values.displayName || username);
  if (!displayName.success) return { error: firstError(displayName.error), values };

  const invite = str(formData.get("invite")).trim();
  const [group] = invite ? await db.select().from(groups).where(eq(groups.inviteCode, invite)).limit(1) : [];
  const requiredCode = process.env.SIGNUP_CODE;
  if (requiredCode && !group && str(formData.get("signupCode")).trim() !== requiredCode) {
    return { error: "That signup code isn't right — ask a friend for an invite link.", values };
  }

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (taken) return { error: "That username is taken.", values };

  let userId: string;
  try {
    const [user] = await db
      .insert(users)
      .values({ username, displayName: displayName.data, passwordHash: await hashPassword(password), timezone })
      .returning({ id: users.id });
    userId = user.id;
  } catch {
    return { error: "That username is taken.", values };
  }
  if (group) await db.insert(groupMembers).values({ groupId: group.id, userId }).onConflictDoNothing();
  await createSession(userId);
  redirect(group ? `/groups/${group.id}?welcome=1` : "/?welcome=1");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = str(formData.get("username")).trim().toLowerCase();
  const password = str(formData.get("password"));
  const values = { username };
  if (!username || !password) return { error: "Enter your username and password.", values };

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await getDummyHash()), false);
  if (!user || !ok) return { error: "Wrong username or password.", values };

  const tz = timezoneSchema.parse(str(formData.get("timezone")) || undefined);
  if (tz !== "UTC" && tz !== user.timezone) await db.update(users).set({ timezone: tz }).where(eq(users.id, user.id));
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
