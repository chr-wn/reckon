import { sql } from "drizzle-orm";
import { doublePrecision, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// Every table has row-level security ENABLED with no policies. The app connects
// as the table owner (which bypasses RLS), while Supabase's public Data API roles
// (anon / authenticated) can read and write nothing. Keep `.enableRLS()` on any
// new table.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Lowercase, unique handle used in URLs (derived from the Google email). */
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  /** Google account id ("sub" claim). Null only for local demo users. */
  googleSub: text("google_sub").unique(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  /** Legacy: accounts from the old username/password login. Unused. */
  passwordHash: text("password_hash"),
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
    /** public = every signed-in friend can see and forecast; private = only the author. */
    visibility: text("visibility", { enum: ["public", "private"] }).notNull().default("public"),
    /** Legacy, no longer shown in the UI. */
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

export type User = typeof users.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Forecast = typeof forecasts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type QuestionType = Question["type"];
