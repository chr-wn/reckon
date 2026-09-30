import { z } from "zod";
import { DURATION_UNITS } from "./constants";

export const visibilitySchema = z.enum(["public", "private"]);

/** How sure the range is: any 1%–99%, set with the same slider as yes/no probabilities. */
const confidence = z.number().min(0.01, "Use 1%–99%").max(0.99, "Use 1%–99%");
export const probabilitySchema = z.number().min(0.01, "Use 1%–99%").max(0.99, "Use 1%–99%");

/** A best guess, with an optional range (both ends or neither). */
export const quantilesSchema = z
  .object({ low: z.number().nullable().default(null), median: z.number(), high: z.number().nullable().default(null) })
  .refine((q) => (q.low == null) === (q.high == null), "Give both ends of the range, or leave both empty")
  .refine((q) => q.low == null || q.high == null || (q.low <= q.median && q.median <= q.high), "Needs low ≤ best guess ≤ high")
  .refine((q) => q.low == null || q.high == null || q.low < q.high, "Low and high can't be equal — give yourself a range");

const common = {
  title: z.string().trim().min(3, "Question is too short").max(300),
  details: z.string().trim().max(5000).optional().default(""),
  visibility: visibilitySchema.default("public"),
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
  z.object({
    ...common,
    type: z.literal("date"),
    confidence,
    /** epoch ms; with a time of day, or local noon for a day */
    forecast: quantilesSchema,
    withTime: z.boolean().default(false),
  }),
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
  visibility: visibilitySchema,
  closesAt: common.closesAt,
});
export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>;

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}
