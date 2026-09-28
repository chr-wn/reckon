"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUser, revokeOtherSessions } from "@/lib/auth/session";
import { db, users } from "@/lib/db";
import { displayNameSchema, firstError, passwordSchema } from "@/lib/validation";
import { isValidTimeZone } from "@/lib/format";

export interface FormState {
  error?: string;
  ok?: string;
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = displayNameSchema.safeParse(formData.get("displayName"));
  if (!name.success) return { error: firstError(name.error) };
  const tz = String(formData.get("timezone") ?? "");
  if (!isValidTimeZone(tz)) return { error: "Unknown time zone." };
  await db.update(users).set({ displayName: name.data, timezone: tz }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = passwordSchema.safeParse(formData.get("next"));
  if (!next.success) return { error: firstError(next.error) };
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(current, row.hash))) return { error: "Current password is wrong." };
  await db.update(users).set({ passwordHash: await hashPassword(next.data) }).where(eq(users.id, user.id));
  await revokeOtherSessions(user.id);
  return { ok: "Password changed. Other devices were signed out." };
}
