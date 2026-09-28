"use server";

import { randomUUID } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db, drillAttempts } from "@/lib/db";
import { pickRound, scoreCompare, scoreInterval, type CompareResult, type DrillItem, type DrillMode, type IntervalResult } from "@/lib/drills/engine";
import type { ActionResult } from "./questions";

const MODES: DrillMode[] = ["mixed", "interval", "compare"];
const LEVELS = [0.5, 0.8, 0.9];

export async function startRound(mode: DrillMode): Promise<{ roundId: string; items: DrillItem[] }> {
  const user = await requireUser();
  const rows = await db
    .select({ key: drillAttempts.itemKey, at: max(drillAttempts.createdAt) })
    .from(drillAttempts)
    .where(eq(drillAttempts.userId, user.id))
    .groupBy(drillAttempts.itemKey);
  const seen = new Map(rows.map((r) => [r.key, r.at ? new Date(r.at).getTime() : 0]));
  return { roundId: randomUUID(), items: pickRound(MODES.includes(mode) ? mode : "mixed", seen) };
}

async function alreadyAnswered(userId: string, roundId: string, key: string) {
  const [row] = await db
    .select({ id: drillAttempts.id })
    .from(drillAttempts)
    .where(and(eq(drillAttempts.userId, userId), eq(drillAttempts.roundId, roundId), eq(drillAttempts.itemKey, key)))
    .limit(1);
  return !!row;
}

const validRound = (id: string) => typeof id === "string" && id.length > 0 && id.length <= 64;

export async function submitInterval(
  roundId: string,
  key: string,
  low: number,
  high: number,
  confidence: number,
): Promise<ActionResult<IntervalResult>> {
  const user = await requireUser();
  if (!validRound(roundId) || !Number.isFinite(low) || !Number.isFinite(high) || !LEVELS.includes(confidence)) {
    return { ok: false, error: "Invalid answer." };
  }
  const result = scoreInterval(key, low, high);
  if (!result) return { ok: false, error: "Unknown question." };
  if (!(await alreadyAnswered(user.id, roundId, key))) {
    await db.insert(drillAttempts).values({
      userId: user.id,
      roundId,
      itemKey: key,
      kind: "interval",
      confidence,
      low: Math.min(low, high),
      high: Math.max(low, high),
      answer: result.answer,
      correct: result.correct,
    });
  }
  return { ok: true, data: result };
}

export async function submitCompare(roundId: string, key: string, pFirst: number): Promise<ActionResult<CompareResult>> {
  const user = await requireUser();
  if (!validRound(roundId) || !Number.isFinite(pFirst) || pFirst < 0.01 || pFirst > 0.99) return { ok: false, error: "Invalid answer." };
  const result = scoreCompare(key, pFirst);
  if (!result) return { ok: false, error: "Unknown question." };
  if (!(await alreadyAnswered(user.id, roundId, key))) {
    await db.insert(drillAttempts).values({
      userId: user.id,
      roundId,
      itemKey: key,
      kind: "compare",
      probability: pFirst,
      answer: result.firstRight ? 1 : 0,
      correct: result.correct,
    });
  }
  return { ok: true, data: result };
}
