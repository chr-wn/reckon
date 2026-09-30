import { clamp, normCdf, sum, weightedMedian, wilson, zForInterval } from "./math";

/**
 * Continuous forecasts are three quantiles: low = q((1-c)/2), median = q(0.5),
 * high = q((1+c)/2). We interpret them as a two-piece normal in "scoring space"
 * (log space for ratio-type quantities like durations, raw space otherwise):
 * each half is a normal with its own σ, chosen so all three quantiles match
 * exactly. That gives every outcome a standardized error z, which is
 * comparable across questions of wildly different scales:
 *
 *   z ~ N(0, 1)   if you're calibrated
 *   mean z > 0    outcomes tend to exceed your median (e.g. planning fallacy)
 *   |z| too big   intervals too narrow (overconfident)
 */
export type Scale = "linear" | "log";

export interface Quantiles {
  low: number;
  median: number;
  high: number;
}

export const toSpace = (x: number, scale: Scale) => (scale === "log" ? Math.log(x) : x);
export const fromSpace = (u: number, scale: Scale) => (scale === "log" ? Math.exp(u) : u);

export function twoPiece(q: Quantiles, confidence: number, scale: Scale) {
  const z = zForInterval(confidence);
  const l = toSpace(q.low, scale);
  const m = toSpace(q.median, scale);
  const h = toSpace(q.high, scale);
  // A zero-width side (median == low) would be a point mass; give it a sliver of width instead.
  const floor = Math.max(1e-12, Math.abs(h - l) * 1e-3);
  return { m, sL: Math.max(m - l, floor) / z, sR: Math.max(h - m, floor) / z };
}

export function standardizedError(q: Quantiles, actual: number, confidence: number, scale: Scale): number {
  const { m, sL, sR } = twoPiece(q, confidence, scale);
  const y = toSpace(actual, scale);
  return clamp(y < m ? (y - m) / sL : (y - m) / sR, -8, 8);
}

/** Where the outcome fell in your forecast distribution (0 = far below, 1 = far above). */
export const percentileFromZ = normCdf;

export const isHit = (q: Quantiles, actual: number) => actual >= q.low && actual <= q.high;

/**
 * Interval score (Gneiting & Raftery 2007) in scoring space: width plus a
 * penalty of 2/α per unit the outcome falls outside. Proper for central intervals.
 */
export function intervalScore(q: Quantiles, actual: number, confidence: number, scale: Scale): number {
  const alpha = 1 - confidence;
  const l = toSpace(q.low, scale);
  const h = toSpace(q.high, scale);
  const y = toSpace(actual, scale);
  return h - l + (2 / alpha) * Math.max(0, l - y) + (2 / alpha) * Math.max(0, y - h);
}

/**
 * For aggregates, a single absurd ratio (a timer started by accident, a typo)
 * shouldn't swamp everything else: cap each question's influence at 8× either way.
 */
export const MAX_RATIO = 8;
export const clampLogRatio = (lr: number) => clamp(lr, -Math.log(MAX_RATIO), Math.log(MAX_RATIO));

export interface ContinuousPoint {
  z: number;
  /** 1 if inside the interval (can be fractional after time-weighting) */
  hit: number;
  confidence: number;
  w: number;
  /** log-scale questions: ln(actual / median) */
  logRatio?: number;
  /** log-scale questions: ln(high / low), rescaled to an 80%-interval equivalent */
  logWidth80?: number;
}

export interface CoverageLevel {
  /** weighted mean stated confidence of the forecasts in this band (the hit rate to aim for) */
  confidence: number;
  /** "80%", or "65–85%" when the band mixes levels */
  label: string;
  n: number;
  hitRate: number;
  ciLow: number;
  ciHigh: number;
}

export interface ContinuousSummary {
  n: number;
  /** weighted fraction of outcomes inside the stated interval */
  hitRate: number;
  /** weighted mean of stated interval probability (what hitRate should be) */
  targetRate: number;
  byLevel: CoverageLevel[];
  /** fraction of outcomes above the median — 0.5 if unbiased */
  aboveMedian: number;
  meanZ: number;
  /** 10 bins of where outcomes fell in the forecast distribution (proportions) */
  pit: number[];
  pitCounts: number[];
  /** log-scale only: geometric-mean actual / median ("things take 1.4× longer") */
  multiplier: number | null;
  /** log-scale only: typical high/low ratio of an 80% interval */
  typicalWidth80: number | null;
  adjustment: AdjustmentModel;
}

/**
 * Coverage is reported per band of stated confidence, since confidence is a slider (73%, 77%, 82%…);
 * the old fixed levels 50/80/90/95% each fall in their own band.
 */
const COVERAGE_BANDS: [number, number][] = [
  [0, 0.65],
  [0.65, 0.85],
  [0.85, 0.925],
  [0.925, 1],
];

export function summarizeContinuous(points: ContinuousPoint[]): ContinuousSummary | null {
  const n = sum(points.map((p) => p.w));
  if (n <= 0) return null;

  const byLevel = COVERAGE_BANDS.flatMap(([from, to]) => {
    const inBand = points.filter((p) => p.confidence >= from && p.confidence < to);
    const w = sum(inBand.map((p) => p.w));
    if (w <= 0) return [];
    const hits = sum(inBand.map((p) => p.w * p.hit));
    const confidence = sum(inBand.map((p) => p.w * p.confidence)) / w;
    const levels = new Set(inBand.map((p) => Math.round(p.confidence * 100)));
    const label = levels.size === 1 ? `${[...levels][0]}%` : `${Math.round(Math.min(...inBand.map((p) => p.confidence)) * 100)}–${Math.round(Math.max(...inBand.map((p) => p.confidence)) * 100)}%`;
    const [ciLow, ciHigh] = wilson(hits, w);
    return [{ confidence, label, n: w, hitRate: hits / w, ciLow, ciHigh }];
  });

  const pitCounts = Array(10).fill(0) as number[];
  for (const p of points) pitCounts[clamp(Math.floor(percentileFromZ(p.z) * 10), 0, 9)] += p.w;

  const logPts = points.filter((p) => p.logRatio !== undefined);
  const logW = sum(logPts.map((p) => p.w));
  const widthPts = points.filter((p) => p.logWidth80 !== undefined);

  return {
    n,
    hitRate: sum(points.map((p) => p.w * p.hit)) / n,
    targetRate: sum(points.map((p) => p.w * p.confidence)) / n,
    byLevel,
    aboveMedian: sum(points.map((p) => p.w * (p.z > 0 ? 1 : p.z === 0 ? 0.5 : 0))) / n,
    meanZ: sum(points.map((p) => p.w * p.z)) / n,
    pit: pitCounts.map((c) => c / n),
    pitCounts,
    multiplier: logW > 0 ? Math.exp(sum(logPts.map((p) => p.w * clampLogRatio(p.logRatio!))) / logW) : null,
    typicalWidth80: widthPts.length
      ? Math.exp(
          weightedMedian(
            widthPts.map((p) => p.logWidth80!),
            widthPts.map((p) => p.w),
          ),
        )
      : null,
    adjustment: fitAdjustment(points),
  };
}

/**
 * Personal "outside view" model: across your resolved forecasts, the
 * standardized error z looks like N(bias, spread²). Shrunk toward the
 * calibrated N(0, 1) with a prior worth PRIOR_N questions, so a couple of
 * misses nudge rather than whipsaw the suggestion.
 */
export interface AdjustmentModel {
  n: number;
  bias: number;
  spread: number;
}

const PRIOR_N = 2;
const Z_CAP = 5; // one catastrophic miss shouldn't dominate

export function fitAdjustment(points: Pick<ContinuousPoint, "z" | "w">[]): AdjustmentModel {
  const n = sum(points.map((p) => p.w));
  const zs = points.map((p) => clamp(p.z, -Z_CAP, Z_CAP));
  const bias = sum(points.map((p, i) => p.w * zs[i])) / (n + PRIOR_N);
  const mse = (sum(points.map((p, i) => p.w * (zs[i] - bias) ** 2)) + PRIOR_N) / (n + PRIOR_N);
  return { n, bias, spread: Math.sqrt(mse) };
}

/**
 * Re-express a raw forecast through your track record: if reality lands at
 * z ~ N(bias, spread²) in your forecast's own coordinates, the calibrated
 * quantiles are at z = bias ± spread·z_c, mapped back through the same
 * two-piece shape.
 */
export function applyAdjustment(q: Quantiles, confidence: number, scale: Scale, model: AdjustmentModel): Quantiles {
  const { m, sL, sR } = twoPiece(q, confidence, scale);
  const zc = zForInterval(confidence);
  const at = (z: number) => fromSpace(m + z * (z < 0 ? sL : sR), scale);
  return {
    low: at(model.bias - model.spread * zc),
    median: at(model.bias),
    high: at(model.bias + model.spread * zc),
  };
}

/** Summary of how the adjustment model reads, for UI copy. */
export function describeAdjustment(model: AdjustmentModel) {
  return {
    /** implied hit rate of your raw intervals at the given confidence */
    impliedHitRate: (confidence: number) => {
      const zc = zForInterval(confidence);
      return normCdf((zc - model.bias) / model.spread) - normCdf((-zc - model.bias) / model.spread);
    },
    /** implied share of outcomes above your median */
    impliedAboveMedian: 1 - normCdf(-model.bias / model.spread),
  };
}
