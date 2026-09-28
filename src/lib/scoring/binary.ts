import { clamp, logit, sigmoid, sum, wilson } from "./math";

export interface BinaryPoint {
  /** forecast probability of YES */
  p: number;
  /** 1 = YES happened */
  o: 0 | 1;
  /** weight (time-weighted share of one question; sums to 1 per question) */
  w: number;
}

export const brier = (p: number, o: number) => (p - o) ** 2;

export interface CalibrationBin {
  /** nominal bin label, e.g. 0.7 for forecasts in [65%, 75%) */
  center: number;
  n: number;
  meanP: number;
  freq: number;
  ciLow: number;
  ciHigh: number;
}

/** 11 bins centred on 0%, 10%, …, 100% so round forecasts land mid-bin. */
export const BIN_CENTERS = Array.from({ length: 11 }, (_, i) => i / 10);

export const binIndex = (p: number) => clamp(Math.round(p * 10 + 1e-9), 0, 10);

export function calibrationBins(points: BinaryPoint[]): CalibrationBin[] {
  const acc = BIN_CENTERS.map(() => ({ w: 0, wp: 0, wo: 0 }));
  for (const { p, o, w } of points) {
    const b = acc[binIndex(p)];
    b.w += w;
    b.wp += w * p;
    b.wo += w * o;
  }
  return acc.map((b, i) => {
    const [ciLow, ciHigh] = wilson(b.wo, b.w);
    return {
      center: BIN_CENTERS[i],
      n: b.w,
      meanP: b.w > 0 ? b.wp / b.w : BIN_CENTERS[i],
      freq: b.w > 0 ? b.wo / b.w : NaN,
      ciLow,
      ciHigh,
    };
  });
}

/**
 * Logistic recalibration: P(yes) = σ(a + b·logit(p)).
 *   b < 1 → overconfident (your extremes should be pulled toward 50%)
 *   b > 1 → underconfident
 *   a < 0 → things happen less often than you say (optimism about YES)
 * MAP estimate with weak priors a ~ N(0, 1), b ~ N(1, 0.5²) so a handful of
 * questions can't produce a wild fit.
 */
export interface RecalibrationFit {
  a: number;
  b: number;
  sdA: number;
  sdB: number;
  n: number;
}

export function fitRecalibration(points: BinaryPoint[]): RecalibrationFit {
  const PRIOR_SD_A = 1;
  const PRIOR_SD_B = 0.5;
  const xs = points.map((pt) => logit(clamp(pt.p, 0.005, 0.995)));
  let a = 0;
  let b = 1;
  let haa = 0;
  let hab = 0;
  let hbb = 0;
  for (let iter = 0; iter < 50; iter++) {
    let ga = -a / PRIOR_SD_A ** 2;
    let gb = -(b - 1) / PRIOR_SD_B ** 2;
    haa = -1 / PRIOR_SD_A ** 2;
    hab = 0;
    hbb = -1 / PRIOR_SD_B ** 2;
    points.forEach((pt, i) => {
      const x = xs[i];
      const pi = sigmoid(a + b * x);
      const r = pt.w * (pt.o - pi);
      const v = pt.w * pi * (1 - pi);
      ga += r;
      gb += r * x;
      haa -= v;
      hab -= v * x;
      hbb -= v * x * x;
    });
    const det = haa * hbb - hab * hab;
    const da = (hbb * ga - hab * gb) / det;
    const db = (-hab * ga + haa * gb) / det;
    a -= da;
    b -= db;
    if (Math.abs(da) + Math.abs(db) < 1e-9) break;
  }
  // Posterior covariance ≈ (−H)⁻¹
  const det = haa * hbb - hab * hab;
  return {
    a,
    b,
    sdA: Math.sqrt(Math.max(0, -hbb / det)),
    sdB: Math.sqrt(Math.max(0, -haa / det)),
    n: sum(points.map((p) => p.w)),
  };
}

export const recalibrate = (p: number, fit: Pick<RecalibrationFit, "a" | "b">) =>
  sigmoid(fit.a + fit.b * logit(clamp(p, 0.005, 0.995)));

export type ConfidenceVerdict =
  | "not-enough-data"
  | "overconfident"
  | "slightly-overconfident"
  | "well-calibrated"
  | "slightly-underconfident"
  | "underconfident";

export const MIN_FOR_VERDICT = 8;

export function confidenceVerdict(fit: RecalibrationFit): ConfidenceVerdict {
  if (fit.n < MIN_FOR_VERDICT) return "not-enough-data";
  const d = fit.b - 1;
  if (d < -2 * fit.sdB) return "overconfident";
  if (d < -fit.sdB) return "slightly-overconfident";
  if (d > 2 * fit.sdB) return "underconfident";
  if (d > fit.sdB) return "slightly-underconfident";
  return "well-calibrated";
}

/** Does the intercept show a clear lean toward over- or under-predicting YES? */
export function yesBias(fit: RecalibrationFit): "optimistic" | "pessimistic" | null {
  if (fit.n < MIN_FOR_VERDICT) return null;
  if (fit.a < -1.5 * fit.sdA) return "optimistic";
  if (fit.a > 1.5 * fit.sdA) return "pessimistic";
  return null;
}

export interface BinarySummary {
  /** effective number of questions */
  n: number;
  brier: number;
  /** mean forecast vs. how often things actually happened */
  meanP: number;
  baseRate: number;
  bins: CalibrationBin[];
  fit: RecalibrationFit;
  verdict: ConfidenceVerdict;
}

export function summarizeBinary(points: BinaryPoint[]): BinarySummary | null {
  const n = sum(points.map((p) => p.w));
  if (n <= 0) return null;
  const fit = fitRecalibration(points);
  return {
    n,
    brier: sum(points.map((p) => p.w * brier(p.p, p.o))) / n,
    meanP: sum(points.map((p) => p.w * p.p)) / n,
    baseRate: sum(points.map((p) => p.w * p.o)) / n,
    bins: calibrationBins(points),
    fit,
    verdict: confidenceVerdict(fit),
  };
}
