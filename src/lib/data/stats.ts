import "server-only";
import { and, eq, exists, inArray, isNotNull, sql } from "drizzle-orm";
import { db, forecasts, groupMembers, questionGroups, questions, users } from "@/lib/db";
import { scoreQuestion, type ScoredRecord } from "@/lib/scoring/records";
import { visibleTo } from "./questions";

/** Scored records for `targetId`'s forecasts on resolved questions that `viewerId` is allowed to see. */
export async function loadUserRecords(targetId: string, viewerId: string): Promise<ScoredRecord[]> {
  const qs = await db
    .select()
    .from(questions)
    .where(
      and(
        isNotNull(questions.resolvedAt),
        visibleTo(viewerId),
        exists(
          db
            .select({ one: sql`1` })
            .from(forecasts)
            .where(and(eq(forecasts.questionId, questions.id), eq(forecasts.userId, targetId))),
        ),
      ),
    );
  if (!qs.length) return [];
  const fs = await db
    .select()
    .from(forecasts)
    .where(
      and(
        inArray(
          forecasts.questionId,
          qs.map((q) => q.id),
        ),
        eq(forecasts.userId, targetId),
      ),
    );
  return qs.flatMap((q) => scoreQuestion(q, fs));
}

/** Scored records for every current member's forecasts on resolved questions shared into the group. */
export async function loadGroupRecords(groupId: string): Promise<ScoredRecord[]> {
  const qs = await db
    .select({ q: questions })
    .from(questions)
    .innerJoin(questionGroups, eq(questionGroups.questionId, questions.id))
    .where(and(eq(questionGroups.groupId, groupId), isNotNull(questions.resolvedAt)));
  if (!qs.length) return [];
  const memberIds = db.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  const fs = await db
    .select()
    .from(forecasts)
    .where(
      and(
        inArray(
          forecasts.questionId,
          qs.map((r) => r.q.id),
        ),
        inArray(forecasts.userId, memberIds),
      ),
    );
  return qs.flatMap((r) => scoreQuestion(r.q, fs));
}

export async function getUserByUsername(username: string) {
  const [u] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return u ?? null;
}
