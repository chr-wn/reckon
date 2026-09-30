export const APP_NAME = "Reckon";
export const APP_TAGLINE = "Predictions with friends";

export const DEFAULT_CONFIDENCE = 0.8;

export const DURATION_UNITS = ["minutes", "hours", "days"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];
export const MINUTES_PER: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 1440 };

export const TYPE_LABELS = {
  binary: "Yes / no",
  duration: "How long",
  numeric: "How much",
  date: "When",
} as const;
