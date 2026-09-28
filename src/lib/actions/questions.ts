"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { comments, db, forecasts, groupMembers, questionGroups, questions, type Question } from "@/lib/db";
import { getVisibleQuestion, isOpenForForecasts } from "@/lib/data/questions";
import { effectiveScale } from "@/lib/scoring/records";
import {
  createQuestionSchema,
  firstError,
  forecastSchema,
  resolveSchema,
  updateQuestionSchema,
  type CreateQuestionInput,
  type ForecastInput,
  type ResolveInput,
  type UpdateQuestionInput,
} from "@/lib/validation";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const refreshAll = () => revalidatePath("/", "layout");

async function memberGroupIds(userId: string, groupIds: string[]): Promise<string[]> {
  if (!groupIds.length) return [];
  const rows = await db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, userId), inArray(groupMembers.groupId, groupIds)));
  return rows.map((r) => r.id);
}

function checkQuantiles(type: Question["type"], scale: "linear" | "log", q: { low: number }): string | null {
  if ((type === "duration" || scale === "log") && q.low <= 0) {
    return type === "duration" ? "Durations must be greater than zero." : "Log-scale questions need positive values.";
  }
  return null;
}

export async function createQuestion(input: CreateQuestionInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createQuestionSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;

  if (d.closesAt != null && d.closesAt < Date.now() - 60_000) return fail("The resolve-by date is in the past.");
  const scale = d.type === "numeric" ? d.scale : d.type === "duration" ? "log" : "linear";
  if (d.type !== "binary") {
    const err = checkQuantiles(d.type, scale, d.forecast);
    if (err) return fail(err);
  }
  const groupIds = await memberGroupIds(user.id, d.groupIds);
  const now = new Date();
  const startTimer = d.type === "duration" && d.startTimer;

  const id = await db.transaction(async (tx) => {
    const [q] = await tx
      .insert(questions)
      .values({
        authorId: user.id,
        type: d.type,
        title: d.title,
        details: d.details || null,
        tags: [...new Set(d.tags)],
        unit: d.type === "numeric" ? d.unit || null : d.type === "duration" ? d.unit : null,
        scale,
        confidence: d.type === "binary" ? 0.8 : d.confidence,
        closesAt: d.closesAt != null ? new Date(d.closesAt) : null,
        workStartedAt: startTimer ? now : null,
        timerRunningSince: startTimer ? now : null,
      })
      .returning({ id: questions.id });
    if (groupIds.length) await tx.insert(questionGroups).values(groupIds.map((groupId) => ({ questionId: q.id, groupId })));
    await tx.insert(forecasts).values({
      questionId: q.id,
      userId: user.id,
      note: d.note || null,
      createdAt: now,
      ...(d.type === "binary" ? { probability: d.probability } : d.forecast),
    });
    return q.id;
  });
  refreshAll();
  return { ok: true, data: { id } };
}

export async function submitForecast(questionId: string, input: ForecastInput): Promise<ActionResult> {
  const user = await requireUser();
  const q = await getVisibleQuestion(questionId, user.id);
  if (!q) return fail("Question not found.");
  if (!isOpenForForecasts(q)) return fail("Forecasting is closed on this question.");
  const parsed = forecastSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;
  if (q.type === "binary") {
    if (!("probability" in d)) return fail("Give a probability.");
    await db.insert(forecasts).values({ questionId, userId: user.id, probability: d.probability, note: d.note || null });
  } else {
    if (!("forecast" in d)) return fail("Give a range.");
    const err = checkQuantiles(q.type, effectiveScale(q), d.forecast);
    if (err) return fail(err);
    await db.insert(forecasts).values({ questionId, userId: user.id, ...d.forecast, note: d.note || null });
  }
  refreshAll();
  return { ok: true, data: undefined };
}

async function requireAuthorQuestion(questionId: string) {
  const user = await requireUser();
  const q = await getVisibleQuestion(questionId, user.id);
  if (!q || q.authorId !== user.id) return { user, q: null };
  return { user, q };
}

function stoppedTimer(q: Question, now: Date) {
  const running = q.timerRunningSince ? now.getTime() - q.timerRunningSince.getTime() : 0;
  return { timerRunningSince: null, timerAccumulatedMs: q.timerAccumulatedMs + Math.max(0, running) };
}

export async function resolveQuestion(questionId: string, input: ResolveInput): Promise<ActionResult> {
  const { q } = await requireAuthorQuestion(questionId);
  if (!q) return fail("Only the question's author can resolve it.");
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;
  if (q.type === "binary" && d.resolution === "value") return fail("Resolve yes/no questions with Yes or No.");
  if (q.type !== "binary" && (d.resolution === "yes" || d.resolution === "no")) return fail("Enter the actual value.");
  if (d.resolution === "value" && (q.type === "duration" || effectiveScale(q) === "log") && d.value <= 0) {
    return fail("The value must be greater than zero.");
  }
  const now = new Date();
  await db
    .update(questions)
    .set({
      resolution: d.resolution,
      resolutionValue: d.resolution === "value" ? d.value : null,
      resolutionNote: d.note || null,
      resolvedAt: now,
      updatedAt: now,
      ...(q.type === "duration" ? stoppedTimer(q, now) : {}),
    })
    .where(eq(questions.id, q.id));
  refreshAll();
  return { ok: true, data: undefined };
}

/** Post-resolution reflection ("what did I miss?") stored as the resolution note. */
export async function saveReflection(questionId: string, note: string): Promise<ActionResult> {
  const { q } = await requireAuthorQuestion(questionId);
  if (!q || !q.resolvedAt) return fail("Only the author can add a reflection after resolving.");
  const parsed = z.string().trim().max(2000).safeParse(note);
  if (!parsed.success) return fail(firstError(parsed.error));
  await db
    .update(questions)
    .set({ resolutionNote: parsed.data || null, updatedAt: new Date() })
    .where(eq(questions.id, q.id));
  refreshAll();
  return { ok: true, data: undefined };
}

export async function unresolveQuestion(questionId: string): Promise<ActionResult> {
  const { q } = await requireAuthorQuestion(questionId);
  if (!q) return fail("Only the question's author can do that.");
  await db
    .update(questions)
    .set({ resolution: null, resolutionValue: null, resolutionNote: null, resolvedAt: null, updatedAt: new Date() })
    .where(eq(questions.id, q.id));
  refreshAll();
  return { ok: true, data: undefined };
}

export async function timerControl(questionId: string, action: "start" | "pause" | "reset"): Promise<ActionResult> {
  const { q } = await requireAuthorQuestion(questionId);
  if (!q || q.type !== "duration") return fail("Only the author can time this task.");
  if (q.resolvedAt) return fail("This task is already resolved.");
  const now = new Date();
  let patch: Partial<Question>;
  if (action === "start") {
    if (q.timerRunningSince) return { ok: true, data: undefined };
    patch = { timerRunningSince: now, workStartedAt: q.workStartedAt ?? now };
  } else if (action === "pause") {
    patch = stoppedTimer(q, now);
  } else {
    patch = { timerRunningSince: null, timerAccumulatedMs: 0, workStartedAt: null };
  }
  await db
    .update(questions)
    .set({ ...patch, updatedAt: now })
    .where(eq(questions.id, q.id));
  refreshAll();
  return { ok: true, data: undefined };
}

/** "Done" on a running task: stop the clock and resolve with the measured time. */
export async function finishTimer(questionId: string): Promise<ActionResult<{ minutes: number }>> {
  const { q } = await requireAuthorQuestion(questionId);
  if (!q || q.type !== "duration") return fail("Only the author can time this task.");
  if (q.resolvedAt) return fail("This task is already resolved.");
  const now = new Date();
  const timer = stoppedTimer(q, now);
  const minutes = timer.timerAccumulatedMs / 60000;
  if (minutes <= 0) return fail("The timer hasn't run yet.");
  await db
    .update(questions)
    .set({ ...timer, resolution: "value", resolutionValue: minutes, resolvedAt: now, updatedAt: now })
    .where(eq(questions.id, q.id));
  refreshAll();
  return { ok: true, data: { minutes } };
}

export async function updateQuestion(questionId: string, input: UpdateQuestionInput): Promise<ActionResult> {
  const { user, q } = await requireAuthorQuestion(questionId);
  if (!q) return fail("Only the question's author can edit it.");
  const parsed = updateQuestionSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;
  const groupIds = await memberGroupIds(user.id, d.groupIds);
  await db.transaction(async (tx) => {
    await tx
      .update(questions)
      .set({
        title: d.title,
        details: d.details || null,
        tags: [...new Set(d.tags)],
        closesAt: d.closesAt != null ? new Date(d.closesAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, q.id));
    await tx.delete(questionGroups).where(eq(questionGroups.questionId, q.id));
    if (groupIds.length) await tx.insert(questionGroups).values(groupIds.map((groupId) => ({ questionId: q.id, groupId })));
  });
  refreshAll();
  return { ok: true, data: undefined };
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { q } = await requireAuthorQuestion(questionId);
  if (!q) return;
  await db.delete(questions).where(eq(questions.id, q.id));
  refreshAll();
  redirect("/questions");
}

const commentSchema = z.string().trim().min(1, "Say something first").max(2000);

export async function addComment(questionId: string, body: string): Promise<ActionResult> {
  const user = await requireUser();
  const q = await getVisibleQuestion(questionId, user.id);
  if (!q) return fail("Question not found.");
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return fail(firstError(parsed.error));
  await db.insert(comments).values({ questionId, userId: user.id, body: parsed.data });
  refreshAll();
  return { ok: true, data: undefined };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) return fail("Not found.");
  await db.delete(comments).where(and(eq(comments.id, commentId), eq(comments.userId, user.id)));
  refreshAll();
  return { ok: true, data: undefined };
}
