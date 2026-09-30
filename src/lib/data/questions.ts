import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { comments, db, forecasts, questions, users, type Forecast, type Question } from "@/lib/db";
import { median } from "@/lib/scoring/math";
import { scoreQuestion, type ScoredRecord } from "@/lib/scoring/records";

export interface UserLite {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

const userLite = { id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl };

/** SQL predicate: your own predictions, plus everyone's public ones. */
export function visibleTo(userId: string): SQL {
  return or(eq(questions.authorId, userId), eq(questions.visibility, "public"))!;
}

/** Forecasting is open until resolution, the close time, or (for timed tasks) the moment work starts. */
export function isOpenForForecasts(q: Pick<Question, "resolvedAt" | "closesAt" | "workStartedAt">, now = Date.now()) {
  return !q.resolvedAt && !q.workStartedAt && (!q.closesAt || q.closesAt.getTime() > now);
}

export type ForecastLite = Pick<Forecast, "userId" | "probability" | "low" | "median" | "high" | "createdAt">;

export interface QuestionRow extends Question {
  author: UserLite;
  forecasterCount: number;
  myForecast: ForecastLite | null;
  /** Friends' latest forecasts, summarized — only once you've forecast (or it's closed). */
  others: { count: number; probability: number | null; median: number | null } | null;
  /** your score record if resolved and you forecast */
  myRecord: ScoredRecord | null;
}

async function hydrateRows(rows: (Question & { author: UserLite })[], viewerId: string, now: number): Promise<QuestionRow[]> {
  if (!rows.length) return [];
  const fs = await db
    .select({
      questionId: forecasts.questionId,
      userId: forecasts.userId,
      probability: forecasts.probability,
      low: forecasts.low,
      median: forecasts.median,
      high: forecasts.high,
      createdAt: forecasts.createdAt,
    })
    .from(forecasts)
    .where(
      inArray(
        forecasts.questionId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(forecasts.createdAt));
  const byQ = new Map<string, typeof fs>();
  for (const f of fs) byQ.set(f.questionId, [...(byQ.get(f.questionId) ?? []), f]);

  return rows.map((q) => {
    const list = byQ.get(q.id) ?? [];
    const mine = list.filter((f) => f.userId === viewerId);
    const latest = new Map<string, (typeof fs)[number]>();
    for (const f of list) latest.set(f.userId, f); // ascending → last wins
    const theirs = [...latest.values()].filter((f) => f.userId !== viewerId);
    const revealed = mine.length > 0 || !isOpenForForecasts(q, now);
    const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);
    return {
      ...q,
      forecasterCount: latest.size,
      myForecast: mine.length ? mine[mine.length - 1] : null,
      others:
        revealed && theirs.length
          ? {
              count: theirs.length,
              probability: q.type === "binary" ? median(nums(theirs.map((f) => f.probability))) : null,
              median: q.type === "binary" ? null : median(nums(theirs.map((f) => f.median))),
            }
          : null,
      myRecord: q.resolvedAt && mine.length ? (scoreQuestion(q, mine)[0] ?? null) : null,
    };
  });
}

async function selectRows(where: SQL, order: SQL[], limit = 150) {
  const rows = await db
    .select({ q: questions, author: userLite })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.authorId))
    .where(where)
    .orderBy(...order)
    .limit(limit);
  return rows.map((r) => ({ ...r.q, author: r.author }));
}

export const STATUSES = ["open", "resolve", "resolved", "all"] as const;
export type StreamStatus = (typeof STATUSES)[number];
export const SORTS = ["new", "closing", "resolved"] as const;
export type StreamSort = (typeof SORTS)[number];

export const defaultSort = (status: StreamStatus): StreamSort =>
  status === "resolved" ? "resolved" : status === "resolve" ? "closing" : "new";

/** The home stream: everything visible to you, filtered by state and author. */
export async function listStream(
  viewerId: string,
  opts: { status: StreamStatus; authorId?: string; sort: StreamSort },
  now: number,
): Promise<QuestionRow[]> {
  const nowDate = new Date(now);
  const conds: SQL[] = [visibleTo(viewerId)];
  if (opts.authorId) conds.push(eq(questions.authorId, opts.authorId));
  if (opts.status === "open") conds.push(isNull(questions.resolvedAt), or(isNull(questions.closesAt), gt(questions.closesAt, nowDate))!);
  if (opts.status === "resolve") conds.push(isNull(questions.resolvedAt), isNull(questions.workStartedAt), lt(questions.closesAt, nowDate));
  if (opts.status === "resolved") conds.push(isNotNull(questions.resolvedAt));
  const order =
    opts.sort === "closing"
      ? [sql`${questions.closesAt} asc nulls last`, desc(questions.createdAt)]
      : opts.sort === "resolved"
        ? [sql`${questions.resolvedAt} desc nulls last`, desc(questions.createdAt)]
        : [desc(questions.createdAt)];
  return hydrateRows(await selectRows(and(...conds)!, order), viewerId, now);
}

/** Your timed tasks that have started but aren't resolved. */
export async function listInProgress(userId: string, now: number): Promise<QuestionRow[]> {
  const rows = await selectRows(
    and(eq(questions.authorId, userId), eq(questions.type, "duration"), isNull(questions.resolvedAt), isNotNull(questions.workStartedAt))!,
    [desc(questions.workStartedAt)],
    10,
  );
  return hydrateRows(rows, userId, now);
}

export async function listUsers(): Promise<UserLite[]> {
  return db.select(userLite).from(users).orderBy(asc(users.displayName));
}

export interface ForecastView extends Forecast {
  user: UserLite;
}

export interface CommentView {
  id: string;
  body: string;
  createdAt: Date;
  user: UserLite;
}

export interface QuestionDetail {
  question: Question & { author: UserLite };
  isAuthor: boolean;
  /** Others' forecasts stay hidden until you've forecast (or forecasting closes), to avoid anchoring. Comments are always shown. */
  revealed: boolean;
  forecasts: ForecastView[];
  /** Others' forecasts while they're hidden: who and when, never the numbers or notes. */
  hiddenForecasts: { id: string; createdAt: Date; user: UserLite }[];
  forecasterCount: number;
  comments: CommentView[];
  records: ScoredRecord[];
}

export async function getQuestionDetail(id: string, viewerId: string): Promise<QuestionDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await selectRows(and(eq(questions.id, id), visibleTo(viewerId))!, [asc(questions.createdAt)], 1);
  if (!row) return null;

  const [allForecasts, cs] = await Promise.all([
    db
      .select({ f: forecasts, user: userLite })
      .from(forecasts)
      .innerJoin(users, eq(users.id, forecasts.userId))
      .where(eq(forecasts.questionId, id))
      .orderBy(asc(forecasts.createdAt)),
    db
      .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, user: userLite })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.questionId, id))
      .orderBy(asc(comments.createdAt)),
  ]);

  const views: ForecastView[] = allForecasts.map((r) => ({ ...r.f, user: r.user }));
  const hasForecast = views.some((f) => f.userId === viewerId);
  const revealed = hasForecast || !!row.resolvedAt || !isOpenForForecasts(row);
  const visible = revealed ? views : views.filter((f) => f.userId === viewerId);

  return {
    question: row,
    isAuthor: row.authorId === viewerId,
    revealed,
    forecasts: visible,
    hiddenForecasts: revealed ? [] : views.filter((f) => f.userId !== viewerId).map((f) => ({ id: f.id, createdAt: f.createdAt, user: f.user })),
    forecasterCount: new Set(views.map((f) => f.userId)).size,
    comments: cs,
    records: row.resolvedAt ? scoreQuestion(row, visible) : [],
  };
}

/** Raw question for permission checks in actions. */
export async function getVisibleQuestion(id: string, viewerId: string): Promise<Question | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [q] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, id), visibleTo(viewerId)))
    .limit(1);
  return q ?? null;
}
