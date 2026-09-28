import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db, groupMembers, groups, users } from "@/lib/db";
import type { UserLite } from "./questions";

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  role: "owner" | "member";
  memberCount: number;
}

export async function getUserGroups(userId: string): Promise<GroupSummary[]> {
  const mine = await db
    .select({ id: groups.id, name: groups.name, description: groups.description, role: groupMembers.role })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groups.name));
  if (!mine.length) return [];
  const counts = await db
    .select({ groupId: groupMembers.groupId, n: count() })
    .from(groupMembers)
    .where(
      inArray(
        groupMembers.groupId,
        mine.map((g) => g.id),
      ),
    )
    .groupBy(groupMembers.groupId);
  const byId = new Map(counts.map((c) => [c.groupId, c.n]));
  return mine.map((g) => ({ ...g, memberCount: byId.get(g.id) ?? 1 }));
}

export interface GroupMember extends UserLite {
  role: "owner" | "member";
  joinedAt: Date;
}

export async function getGroupForMember(groupId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return null;
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!membership) return null;
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;
  const members: GroupMember[] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt));
  return { group, role: membership.role, members };
}

export async function getGroupByInvite(code: string) {
  const [group] = await db.select().from(groups).where(eq(groups.inviteCode, code)).limit(1);
  if (!group) return null;
  const [{ n }] = await db.select({ n: count() }).from(groupMembers).where(eq(groupMembers.groupId, group.id));
  return { ...group, memberCount: n };
}

/** Do two users share at least one group? */
export async function shareAGroup(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const mine = db.select({ g: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, a));
  const [row] = await db
    .select({ g: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, b), inArray(groupMembers.groupId, mine)))
    .limit(1);
  return !!row;
}
