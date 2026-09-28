import { z } from "zod";
import { CONFIDENCE_LEVELS, DURATION_UNITS } from "./constants";
import { isValidTimeZone } from "./format";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{3,24}$/, "Username: 3–24 characters, letters, numbers, _ or -");
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);
export const displayNameSchema = z.string().trim().min(1, "Name is required").max(40);
export const timezoneSchema = z
  .string()
  .default("UTC")
  .transform((tz) => (isValidTimeZone(tz) ? tz : "UTC"));

export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((t) => t.replace(/^#/, "").replace(/\s+/g, "-"))
  .pipe(z.string().regex(/^[\p{L}\p{N}_-]{1,32}$/u, "Tags: up to 32 letters, numbers, - or _"));

const confidence = z
  .number()
  .refine((c) => CONFIDENCE_LEVELS.some((l) => Math.abs(l - c) < 1e-9), "Unsupported confidence level");
export const probabilitySchema = z.number().min(0.01, "Use 1%–99%").max(0.99, "Use 1%–99%");

export const quantilesSchema = z
  .object({ low: z.number(), median: z.number(), high: z.number() })
  .refine((q) => q.low <= q.median && q.median <= q.high, "Needs low ≤ best guess ≤ high")
  .refine((q) => q.low < q.high, "Low and high can't be equal — give yourself a range");

const common = {
  title: z.string().trim().min(3, "Question is too short").max(300),
  details: z.string().trim().max(5000).optional().default(""),
  tags: z.array(tagSchema).max(8).default([]),
  groupIds: z.array(z.uuid()).max(20).default([]),
  /** epoch ms */
  closesAt: z.number().nullable().default(null),
  note: z.string().trim().max(2000).optional().default(""),
};

export const createQuestionSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("binary"), probability: probabilitySchema }),
  z.object({
    ...common,
    type: z.literal("numeric"),
    unit: z.string().trim().max(30).optional().default(""),
    scale: z.enum(["linear", "log"]).default("linear"),
    confidence,
    forecast: quantilesSchema,
  }),
  z.object({
    ...common,
    type: z.literal("duration"),
    unit: z.enum(DURATION_UNITS),
    confidence,
    /** minutes */
    forecast: quantilesSchema,
    startTimer: z.boolean().default(false),
  }),
  z.object({ ...common, type: z.literal("date"), confidence, forecast: quantilesSchema }),
]);
export type CreateQuestionInput = z.input<typeof createQuestionSchema>;

export const forecastSchema = z.union([
  z.object({ probability: probabilitySchema, note: z.string().trim().max(2000).optional() }),
  z.object({ forecast: quantilesSchema, note: z.string().trim().max(2000).optional() }),
]);
export type ForecastInput = z.input<typeof forecastSchema>;

export const resolveSchema = z.discriminatedUnion("resolution", [
  z.object({ resolution: z.enum(["yes", "no"]), note: z.string().trim().max(2000).optional() }),
  z.object({ resolution: z.literal("ambiguous"), note: z.string().trim().max(2000).optional() }),
  z.object({ resolution: z.literal("value"), value: z.number(), note: z.string().trim().max(2000).optional() }),
]);
export type ResolveInput = z.input<typeof resolveSchema>;

export const updateQuestionSchema = z.object({
  title: common.title,
  details: common.details,
  tags: common.tags,
  groupIds: common.groupIds,
  closesAt: common.closesAt,
});
export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>;

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}
