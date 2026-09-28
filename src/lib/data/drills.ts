import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db, drillAttempts, type DrillAttempt } from "@/lib/db";
import { summarizeBinary, type BinaryPoint } from "@/lib/scoring/binary";
import { wilson } from "@/lib/scoring/math";

export async function getDrillAttempts(userId: string, limit = 2000): Promise<DrillAttempt[]> {
  return db.select().from(drillAttempts).where(eq(drillAttempts.userId, userId)).orderBy(desc(drillAttempts.createdAt)).limit(limit);
}

export async function getDrillAttemptsForUsers(userIds: string[]): Promise<Map<string, DrillAttempt[]>> {
  const out = new Map<string, DrillAttempt[]>(userIds.map((id) => [id, []]));
  if (!userIds.length) return out;
  const rows = await db.select().from(drillAttempts).where(inArray(drillAttempts.userId, userIds)).orderBy(desc(drillAttempts.createdAt));
  for (const r of rows) out.get(r.userId)?.push(r);
  return out;
}

export interface DrillSummary {
  total: number;
  intervalN: number;
  intervalHitRate: number;
  byLevel: { confidence: number; n: number; hitRate: number; ciLow: number; ciHigh: number }[];
  compareN: number;
  compare: ReturnType<typeof summarizeBinary>;
  /** last 50 interval attempts' hit rate, for "are you improving" */
  recentHitRate: number | null;
  rounds: number;
}

export function summarizeDrills(attempts: DrillAttempt[]): DrillSummary {
  const intervals = attempts.filter((a) => a.kind === "interval");
  const compares = attempts.filter((a) => a.kind === "compare" && a.probability != null);
  const levels = new Map<number, { n: number; hits: number }>();
  for (const a of intervals) {
    const c = a.confidence ?? 0.8;
    const l = levels.get(c) ?? { n: 0, hits: 0 };
    l.n += 1;
    l.hits += a.correct ? 1 : 0;
    levels.set(c, l);
  }
  const points: BinaryPoint[] = compares.map((a) => ({ p: a.probability!, o: a.answer >= 0.5 ? 1 : 0, w: 1 }));
  const recent = intervals.slice(0, 50);
  return {
    total: attempts.length,
    intervalN: intervals.length,
    intervalHitRate: intervals.length ? intervals.filter((a) => a.correct).length / intervals.length : NaN,
    byLevel: [...levels.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([confidence, { n, hits }]) => {
        const [ciLow, ciHigh] = wilson(hits, n);
        return { confidence, n, hitRate: hits / n, ciLow, ciHigh };
      }),
    compareN: compares.length,
    compare: summarizeBinary(points),
    recentHitRate: intervals.length >= 60 ? recent.filter((a) => a.correct).length / recent.length : null,
    rounds: new Set(attempts.map((a) => a.roundId)).size,
  };
}

export async function getDrillSummary(userId: string): Promise<DrillSummary> {
  return summarizeDrills(await getDrillAttempts(userId));
}
