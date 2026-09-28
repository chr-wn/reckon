"use server";

import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { db, groupMembers, groups } from "@/lib/db";
import { firstError } from "@/lib/validation";
import type { ActionResult } from "./questions";

const newInviteCode = () => randomBytes(9).toString("base64url");
const groupSchema = z.object({
  name: z.string().trim().min(1, "Give your group a name").max(60),
  description: z.string().trim().max(300).optional().default(""),
});

export async function createGroup(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = groupSchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const id = await db.transaction(async (tx) => {
    const [g] = await tx
      .insert(groups)
      .values({ name: parsed.data.name, description: parsed.data.description || null, inviteCode: newInviteCode(), createdBy: user.id })
      .returning({ id: groups.id });
    await tx.insert(groupMembers).values({ groupId: g.id, userId: user.id, role: "owner" });
    return g.id;
  });
  revalidatePath("/", "layout");
  redirect(`/groups/${id}?created=1`);
}

export async function joinGroup(inviteCode: string): Promise<void> {
  const user = await requireUser();
  const [g] = await db.select({ id: groups.id }).from(groups).where(eq(groups.inviteCode, inviteCode)).limit(1);
  if (!g) redirect("/groups?invalid=1");
  await db.insert(groupMembers).values({ groupId: g.id, userId: user.id }).onConflictDoNothing();
  revalidatePath("/", "layout");
  redirect(`/groups/${g.id}?welcome=1`);
}

async function requireOwner(groupId: string) {
  const user = await requireUser();
  const [m] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)))
    .limit(1);
  return { user, isOwner: m?.role === "owner", isMember: !!m };
}

export async function regenerateInvite(groupId: string): Promise<ActionResult> {
  const { isOwner } = await requireOwner(groupId);
  if (!isOwner) return { ok: false, error: "Only group owners can do that." };
  await db.update(groups).set({ inviteCode: newInviteCode() }).where(eq(groups.id, groupId));
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, data: undefined };
}

export async function updateGroup(groupId: string, name: string, description: string): Promise<ActionResult> {
  const { isOwner } = await requireOwner(groupId);
  if (!isOwner) return { ok: false, error: "Only group owners can do that." };
  const parsed = groupSchema.safeParse({ name, description });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await db
    .update(groups)
    .set({ name: parsed.data.name, description: parsed.data.description || null })
    .where(eq(groups.id, groupId));
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function removeMember(groupId: string, userId: string): Promise<ActionResult> {
  const { user, isOwner } = await requireOwner(groupId);
  if (!isOwner || userId === user.id) return { ok: false, error: "Only group owners can remove other members." };
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, data: undefined };
}

export async function leaveGroup(groupId: string): Promise<void> {
  const { user, isOwner, isMember } = await requireOwner(groupId);
  if (!isMember) redirect("/groups");
  await db.transaction(async (tx) => {
    await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)));
    const [{ n }] = await tx.select({ n: count() }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
    if (n === 0) {
      await tx.delete(groups).where(eq(groups.id, groupId));
    } else if (isOwner) {
      // Hand ownership to the longest-standing remaining member if no owner is left.
      const owners = await tx
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "owner")));
      if (!owners.length) {
        const [next] = await tx
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, groupId))
          .orderBy(groupMembers.joinedAt)
          .limit(1);
        await tx
          .update(groupMembers)
          .set({ role: "owner" })
          .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, next.userId)));
      }
    }
  });
  revalidatePath("/", "layout");
  redirect("/groups");
}
