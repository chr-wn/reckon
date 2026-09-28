import type { ConfidenceVerdict } from "./scoring/binary";

export const VERDICT_COPY: Record<ConfidenceVerdict, { short: string; long: string }> = {
  "not-enough-data": {
    short: "Too early to tell",
    long: "Resolve a few more yes/no questions for a verdict — calibration needs a sample.",
  },
  overconfident: {
    short: "Overconfident",
    long: "Your confident forecasts come true less often than you say. Pull your extremes toward 50%.",
  },
  "slightly-overconfident": {
    short: "Leaning overconfident",
    long: "Some sign your extremes are too extreme. Try nudging 90%s toward 80%, and see if the gap closes.",
  },
  "well-calibrated": {
    short: "Well calibrated",
    long: "No clear sign of over- or underconfidence. Your 70%s are behaving like 70%s.",
  },
  "slightly-underconfident": {
    short: "Leaning underconfident",
    long: "When you lean one way, you're right a bit more often than you claim. You can afford to commit.",
  },
  underconfident: {
    short: "Underconfident",
    long: "You hedge too much: when you lean one way you're right more often than you say. Be bolder.",
  },
};
