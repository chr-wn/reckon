import "server-only";
import { and, asc, desc, eq, exists, gt, ilike, inArray, isNotNull, isNull, lt, ne, notExists, or, sql, type SQL } from "drizzle-orm";
import {
  comments,
  db,
  forecasts,
  groupMembers,
  groups,
  questionGroups,
  questions,
  users,
  type Forecast,
  type Question,
} from "@/lib/db";
import { scoreQuestion, type ScoredRecord } from "@/lib/scoring/records";

export interface UserLite {
  id: string;
  username: string;
  displayName: string;
}

const userLite = { id: users.id, username: users.username, displayName: users.displayName };

/** SQL predicate: the question is the user's own, or shared into a group they belong to. */
export function visibleTo(userId: string): SQL {
  return or(
    eq(questions.authorId, userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(questionGroups)
        .innerJoin(groupMembers, eq(groupMembers.groupId, questionGroups.groupId))
        .where(and(eq(questionGroups.questionId, questions.id), eq(groupMembers.userId, userId))),
    ),
  )!;
}

const forecastBy = (userId: string) =>
  db
    .select({ one: sql`1` })
    .from(forecasts)
    .where(and(eq(forecasts.questionId, questions.id), eq(forecasts.userId, userId)));

/** Forecasting is open until resolution, the close time, or (for timed tasks) the moment work starts. */
export function isOpenForForecasts(q: Pick<Question, "resolvedAt" | "closesAt" | "workStartedAt">, now = Date.now()) {
  return !q.resolvedAt && !q.workStartedAt && (!q.closesAt || q.closesAt.getTime() > now);
}

export type ForecastLite = Pick<Forecast, "userId" | "probability" | "low" | "median" | "high" | "createdAt">;

export interface QuestionRow extends Question {
  author: UserLite;
  forecasterCount: number;
  myForecast: ForecastLite | null;
  /** your score record if resolved and you forecast */
  myRecord: ScoredRecord | null;
}

async function hydrateRows(rows: (Question & { author: UserLite })[], viewerId: string): Promise<QuestionRow[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
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
    .where(inArray(forecasts.questionId, ids))
    .orderBy(asc(forecasts.createdAt));
  const byQ = new Map<string, typeof fs>();
  for (const f of fs) {
    const list = byQ.get(f.questionId) ?? [];
    list.push(f);
    byQ.set(f.questionId, list);
  }
  return rows.map((q) => {
    const list = byQ.get(q.id) ?? [];
    const mine = list.filter((f) => f.userId === viewerId);
    return {
      ...q,
      forecasterCount: new Set(list.map((f) => f.userId)).size,
      myForecast: mine.length ? mine[mine.length - 1] : null,
      myRecord: q.resolvedAt && mine.length ? (scoreQuestion(q, mine)[0] ?? null) : null,
    };
  });
}

async function selectRows(where: SQL, order: SQL[], limit = 100) {
  const rows = await db
    .select({ q: questions, author: userLite })
    .from(questions)
    .innerJoin(users, eq(users.id, questions.authorId))
    .where(where)
    .orderBy(...order)
    .limit(limit);
  return rows.map((r) => ({ ...r.q, author: r.author }));
}

export async function getDashboard(userId: string) {
  const now = new Date();
  const [inProgress, toResolve, awaiting, myOpen, recentlyResolved] = await Promise.all([
    // Tasks whose timer has been started but that aren't resolved yet
    selectRows(
      and(eq(questions.authorId, userId), eq(questions.type, "duration"), isNull(questions.resolvedAt), isNotNull(questions.workStartedAt))!,
      [desc(questions.workStartedAt)],
      20,
    ),
    selectRows(
      and(eq(questions.authorId, userId), isNull(questions.resolvedAt), isNull(questions.workStartedAt), lt(questions.closesAt, now))!,
      [asc(questions.closesAt)],
      50,
    ),
    // Friends' open questions you haven't forecast yet
    selectRows(
      and(
        ne(questions.authorId, userId),
        visibleTo(userId),
        isNull(questions.resolvedAt),
        isNull(questions.workStartedAt),
        or(isNull(questions.closesAt), gt(questions.closesAt, now)),
        notExists(forecastBy(userId)),
      )!,
      [desc(questions.createdAt)],
      20,
    ),
    selectRows(
      and(
        eq(questions.authorId, userId),
        isNull(questions.resolvedAt),
        isNull(questions.workStartedAt),
        or(isNull(questions.closesAt), gt(questions.closesAt, now)),
      )!,
      [sql`${questions.closesAt} asc nulls last`, desc(questions.createdAt)],
      12,
    ),
    selectRows(
      and(visibleTo(userId), isNotNull(questions.resolvedAt), gt(questions.resolvedAt, new Date(now.getTime() - 14 * 864e5)))!,
      [desc(questions.resolvedAt)],
      8,
    ),
  ]);
  const [a, b, c, d, e] = await Promise.all([
    hydrateRows(inProgress, userId),
    hydrateRows(toResolve, userId),
    hydrateRows(awaiting, userId),
    hydrateRows(myOpen, userId),
    hydrateRows(recentlyResolved, userId),
  ]);
  return { inProgress: a, toResolve: b, awaiting: c, myOpen: d, recentlyResolved: e };
}

export type ListStatus = "open" | "resolve" | "resolved" | "all";
export type ListScope = "all" | "mine" | "friends";

export interface ListFilters {
  status?: ListStatus;
  scope?: ListScope;
  type?: Question["type"];
  tag?: string;
  search?: string;
  groupId?: string;
}

export async function listQuestions(userId: string, f: ListFilters): Promise<QuestionRow[]> {
  const now = new Date();
  const conds: SQL[] = [visibleTo(userId)];
  if (f.scope === "mine") conds.push(eq(questions.authorId, userId));
  if (f.scope === "friends") conds.push(ne(questions.authorId, userId));
  if (f.type) conds.push(eq(questions.type, f.type));
  if (f.tag) conds.push(sql`${f.tag} = any(${questions.tags})`);
  if (f.search) conds.push(ilike(questions.title, `%${f.search.replace(/[%_\\]/g, "\\$&")}%`));
  if (f.groupId) {
    conds.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(questionGroups)
          .where(and(eq(questionGroups.questionId, questions.id), eq(questionGroups.groupId, f.groupId))),
      ),
    );
  }
  let order: SQL[] = [desc(questions.createdAt)];
  switch (f.status) {
    case "open":
      conds.push(isNull(questions.resolvedAt), or(isNull(questions.closesAt), gt(questions.closesAt, now))!);
      order = [sql`${questions.closesAt} asc nulls last`, desc(questions.createdAt)];
      break;
    case "resolve":
      // Only authors can resolve, so this is your own overdue questions.
      conds.push(eq(questions.authorId, userId), isNull(questions.resolvedAt), isNull(questions.workStartedAt), lt(questions.closesAt, now));
      order = [asc(questions.closesAt)];
      break;
    case "resolved":
      conds.push(isNotNull(questions.resolvedAt));
      order = [desc(questions.resolvedAt)];
      break;
  }
  return hydrateRows(await selectRows(and(...conds)!, order, 200), userId);
}

export async function getUserTags(userId: string): Promise<string[]> {
  const rows = await db
    .select({ tag: sql<string>`unnest(${questions.tags})` })
    .from(questions)
    .where(eq(questions.authorId, userId));
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.tag, (counts.get(r.tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
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
  groups: { id: string; name: string }[];
  isAuthor: boolean;
  /** Others' forecasts and comments stay hidden until you've forecast (or it resolves), to avoid anchoring. */
  revealed: boolean;
  forecasts: ForecastView[];
  forecasterCount: number;
  comments: CommentView[];
  commentCount: number;
  records: ScoredRecord[];
}

export async function getQuestionDetail(id: string, viewerId: string): Promise<QuestionDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await selectRows(and(eq(questions.id, id), visibleTo(viewerId))!, [asc(questions.createdAt)], 1);
  if (!row) return null;

  const [allForecasts, gs, cs] = await Promise.all([
    db
      .select({ f: forecasts, user: userLite })
      .from(forecasts)
      .innerJoin(users, eq(users.id, forecasts.userId))
      .where(eq(forecasts.questionId, id))
      .orderBy(asc(forecasts.createdAt)),
    db
      .select({ id: groups.id, name: groups.name })
      .from(questionGroups)
      .innerJoin(groups, eq(groups.id, questionGroups.groupId))
      .where(eq(questionGroups.questionId, id)),
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
    groups: gs,
    isAuthor: row.authorId === viewerId,
    revealed,
    forecasts: visible,
    forecasterCount: new Set(views.map((f) => f.userId)).size,
    comments: revealed ? cs : [],
    commentCount: cs.length,
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
