import type { QType } from "./scoring/records";

/** Rotating placeholder examples for the quick composer. */
export const PLACEHOLDERS = [
  "How long will my problem set take?",
  "Will I finish the essay draft by Friday?",
  "Will I go to the gym 3 times this week?",
  "When will my package arrive?",
  "How many hours will I sleep tonight?",
];

/** Guess the question type from how it's phrased. */
export function detectType(title: string): QType | null {
  const t = title.trim().toLowerCase();
  if (!t) return null;
  if (/^how long\b/.test(t)) return "duration";
  if (/^(when|by when|what date)\b/.test(t)) return "date";
  if (/^(how (many|much|far|fast|big|high|old)|what (score|percent|percentage|number|price|temperature|grade)|what will .* (be|score|cost))\b/.test(t)) return "numeric";
  if (/^(will|is|are|does|do|did|can|could|would|should|has|have|won't|am)\b/.test(t)) return "binary";
  return null;
}
