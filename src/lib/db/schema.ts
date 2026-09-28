import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// Every table has row-level security ENABLED with no policies. The app connects
// as the table owner (which bypasses RLS), while Supabase's public Data API roles
// (anon / authenticated) can read and write nothing. Keep `.enableRLS()` on any
// new table.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Lowercase, unique handle used in URLs. */
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** IANA zone (e.g. "America/New_York"), captured from the browser; used to render dates. */
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: ts("created_at").notNull().defaultNow(),
}).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the session token; the raw token only ever lives in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
).enableRLS();

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
}).enableRLS();

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
).enableRLS();

/**
 * binary   – "Will X happen?"            → probability
 * numeric  – "How many / how much X?"    → low / median / high at `confidence`
 * duration – "How long will X take?"     → like numeric, values in minutes, always log scale
 * date     – "When will X happen?"       → like numeric, values are epoch milliseconds
 */
export const questionType = pgEnum("question_type", ["binary", "numeric", "duration", "date"]);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: questionType("type").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** numeric: free-text unit ("pages", "$"); duration: preferred display unit ("minutes" | "hours" | "days"). */
    unit: text("unit"),
    /** How errors are measured for continuous questions: "log" = ratios (1.5× too low), "linear" = differences. */
    scale: text("scale", { enum: ["linear", "log"] }).notNull().default("linear"),
    /** Central interval probability everyone uses on this question (continuous types). */
    confidence: doublePrecision("confidence").notNull().default(0.8),
    /** Forecasting closes and the answer should be known by this time. Optional. */
    closesAt: ts("closes_at"),
    resolvedAt: ts("resolved_at"),
    resolution: text("resolution", { enum: ["yes", "no", "ambiguous", "value"] }),
    resolutionValue: doublePrecision("resolution_value"),
    resolutionNote: text("resolution_note"),
    /** duration: first time the task timer was started; forecasts lock from here on. */
    workStartedAt: ts("work_started_at"),
    /** duration: set while the timer is running (start of the current segment). */
    timerRunningSince: ts("timer_running_since"),
    timerAccumulatedMs: doublePrecision("timer_accumulated_ms").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("questions_author_idx").on(t.authorId),
    index("questions_resolved_idx").on(t.resolvedAt),
    index("questions_closes_idx").on(t.closesAt),
  ],
).enableRLS();

export const questionGroups = pgTable(
  "question_groups",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.groupId] }), index("question_groups_group_idx").on(t.groupId)],
).enableRLS();

export const forecasts = pgTable(
  "forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** binary */
    probability: doublePrecision("probability"),
    /** continuous: quantiles at (1-c)/2, 0.5, (1+c)/2 where c = question.confidence */
    low: doublePrecision("low"),
    median: doublePrecision("median"),
    high: doublePrecision("high"),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("forecasts_question_idx").on(t.questionId, t.createdAt),
    index("forecasts_user_idx").on(t.userId),
  ],
).enableRLS();

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("comments_question_idx").on(t.questionId, t.createdAt)],
).enableRLS();

export const drillAttempts = pgTable(
  "drill_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roundId: text("round_id").notNull(),
    /** Fact id for interval items, "factA|factB" for comparisons. */
    itemKey: text("item_key").notNull(),
    kind: text("kind", { enum: ["interval", "compare"] }).notNull(),
    /** interval: the requested central-interval probability */
    confidence: doublePrecision("confidence"),
    low: doublePrecision("low"),
    high: doublePrecision("high"),
    /** compare: probability that the FIRST option is the right answer */
    probability: doublePrecision("probability"),
    /** interval: the true value; compare: 1 if the first option is right, else 0 */
    answer: doublePrecision("answer").notNull(),
    /** interval: truth inside the interval; compare: leaned toward the right option */
    correct: boolean("correct").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("drill_attempts_user_idx").on(t.userId, t.createdAt)],
).enableRLS();

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Forecast = typeof forecasts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type DrillAttempt = typeof drillAttempts.$inferSelect;
export type QuestionType = Question["type"];
