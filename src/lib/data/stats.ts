import "server-only";
import { and, eq, exists, inArray, isNotNull, sql } from "drizzle-orm";
import { db, forecasts, questions, users } from "@/lib/db";
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

/** Everyone's scored records on resolved public questions — the fair basis for comparing friends. */
export async function loadPublicRecords(): Promise<ScoredRecord[]> {
  const qs = await db
    .select()
    .from(questions)
    .where(and(eq(questions.visibility, "public"), isNotNull(questions.resolvedAt)));
  if (!qs.length) return [];
  const fs = await db
    .select()
    .from(forecasts)
    .where(
      inArray(
        forecasts.questionId,
        qs.map((q) => q.id),
      ),
    );
  return qs.flatMap((q) => scoreQuestion(q, fs));
}

export async function getUserByUsername(username: string) {
  const [u] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return u ?? null;
}
