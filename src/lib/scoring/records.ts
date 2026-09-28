import { brier, fitRecalibration, summarizeBinary, type BinaryPoint, type BinarySummary, type RecalibrationFit } from "./binary";
import {
  clampLogRatio,
  fitAdjustment,
  intervalScore,
  isHit,
  percentileFromZ,
  standardizedError,
  summarizeContinuous,
  toSpace,
  type AdjustmentModel,
  type ContinuousPoint,
  type ContinuousSummary,
  type Quantiles,
  type Scale,
} from "./continuous";
import { median, sum, zForInterval } from "./math";
import { scoringWindowEnd, timeWeighted } from "./weights";

export type QType = "binary" | "numeric" | "duration" | "date";
export type ContinuousType = Exclude<QType, "binary">;
export const CONTINUOUS_TYPES: ContinuousType[] = ["duration", "numeric", "date"];

export interface ScoringQuestion {
  id: string;
  type: QType;
  title: string;
  tags: string[];
  confidence: number;
  scale: Scale;
  authorId: string;
  resolution: "yes" | "no" | "ambiguous" | "value" | null;
  resolutionValue: number | null;
  resolvedAt: Date | null;
  closesAt: Date | null;
  workStartedAt: Date | null;
}

export interface ScoringForecast {
  questionId: string;
  userId: string;
  probability: number | null;
  low: number | null;
  median: number | null;
  high: number | null;
  createdAt: Date;
}

interface RecordBase {
  questionId: string;
  userId: string;
  title: string;
  tags: string[];
  resolvedAt: Date;
  isAuthor: boolean;
}

export interface BinaryRecord extends RecordBase {
  kind: "binary";
  outcome: 0 | 1;
  points: BinaryPoint[];
  /** time-weighted Brier score */
  brier: number;
  /** time-weighted mean probability */
  meanP: number;
}

export interface ContinuousRecord extends RecordBase {
  kind: "continuous";
  type: ContinuousType;
  confidence: number;
  scale: Scale;
  actual: number;
  points: ContinuousPoint[];
  /** time-weighted values */
  hit: number;
  z: number;
  percentile: number;
  intervalScore: number;
  width: number;
  /** log scale: geometric-mean actual/median */
  ratio: number | null;
  /** the forecast standing when the window closed */
  final: Quantiles;
}

export type ScoredRecord = BinaryRecord | ContinuousRecord;

export const effectiveScale = (q: { type: QType; scale: Scale }): Scale =>
  q.type === "duration" ? "log" : q.type === "date" ? "linear" : q.scale;

/** Score every forecaster on one resolved question. */
export function scoreQuestion(q: ScoringQuestion, forecasts: ScoringForecast[]): ScoredRecord[] {
  const end = scoringWindowEnd(q);
  if (!end || !q.resolvedAt || !q.resolution || q.resolution === "ambiguous") return [];

  const byUser = new Map<string, ScoringForecast[]>();
  for (const f of forecasts) {
    if (f.questionId !== q.id) continue;
    const list = byUser.get(f.userId) ?? [];
    list.push(f);
    byUser.set(f.userId, list);
  }

  const out: ScoredRecord[] = [];
  const base = (userId: string): RecordBase => ({
    questionId: q.id,
    userId,
    title: q.title,
    tags: q.tags,
    resolvedAt: q.resolvedAt!,
    isAuthor: userId === q.authorId,
  });

  if (q.type === "binary") {
    if (q.resolution !== "yes" && q.resolution !== "no") return [];
    const o = q.resolution === "yes" ? 1 : 0;
    for (const [userId, list] of byUser) {
      const tw = timeWeighted(
        list.filter((f) => f.probability != null),
        end,
      );
      if (!tw.length) continue;
      const points: BinaryPoint[] = tw.map(({ item, weight }) => ({ p: item.probability!, o, w: weight }));
      out.push({
        ...base(userId),
        kind: "binary",
        outcome: o,
        points,
        brier: sum(points.map((p) => p.w * brier(p.p, o))),
        meanP: sum(points.map((p) => p.w * p.p)),
      });
    }
    return out;
  }

  const actual = q.resolutionValue;
  const scale = effectiveScale(q);
  if (actual == null || !Number.isFinite(actual) || (scale === "log" && actual <= 0)) return [];
  const zc80 = zForInterval(0.8);
  const zc = zForInterval(q.confidence);

  for (const [userId, list] of byUser) {
    const valid = list.filter(
      (f) => f.low != null && f.median != null && f.high != null && (scale === "linear" || f.low > 0),
    );
    const tw = timeWeighted(valid, end);
    if (!tw.length) continue;
    let hit = 0;
    let z = 0;
    let is = 0;
    let width = 0;
    let logRatio = 0;
    const points: ContinuousPoint[] = tw.map(({ item, weight }) => {
      const quant = { low: item.low!, median: item.median!, high: item.high! };
      const pz = standardizedError(quant, actual, q.confidence, scale);
      const ph = isHit(quant, actual) ? 1 : 0;
      hit += weight * ph;
      z += weight * pz;
      is += weight * intervalScore(quant, actual, q.confidence, scale);
      width += weight * (toSpace(quant.high, scale) - toSpace(quant.low, scale));
      const pt: ContinuousPoint = { z: pz, hit: ph, confidence: q.confidence, w: weight };
      if (scale === "log") {
        pt.logRatio = Math.log(actual / quant.median);
        pt.logWidth80 = Math.log(quant.high / quant.low) * (zc80 / zc);
        logRatio += weight * pt.logRatio;
      }
      return pt;
    });
    const last = tw[tw.length - 1].item;
    out.push({
      ...base(userId),
      kind: "continuous",
      type: q.type,
      confidence: q.confidence,
      scale,
      actual,
      points,
      hit,
      z,
      percentile: percentileFromZ(z),
      intervalScore: is,
      width,
      ratio: scale === "log" ? Math.exp(logRatio) : null,
      final: { low: last.low!, median: last.median!, high: last.high! },
    });
  }
  return out;
}

export interface TagSummary {
  tag: string;
  binary: { n: number; meanP: number; freq: number; brier: number } | null;
  continuous: { n: number; hitRate: number; targetRate: number; multiplier: number | null } | null;
}

export interface StatsSummary {
  counts: { binary: number; continuous: number; total: number };
  binary: BinarySummary | null;
  continuous: ContinuousSummary | null;
  byType: Partial<Record<ContinuousType, ContinuousSummary>>;
  tags: TagSummary[];
}

export const isBinary = (r: ScoredRecord): r is BinaryRecord => r.kind === "binary";
export const isContinuous = (r: ScoredRecord): r is ContinuousRecord => r.kind === "continuous";

export function summarize(records: ScoredRecord[]): StatsSummary {
  const bin = records.filter(isBinary);
  const cont = records.filter(isContinuous);
  const byType: StatsSummary["byType"] = {};
  for (const t of CONTINUOUS_TYPES) {
    const s = summarizeContinuous(cont.filter((r) => r.type === t).flatMap((r) => r.points));
    if (s) byType[t] = s;
  }

  const tagNames = [...new Set(records.flatMap((r) => r.tags))];
  const tags: TagSummary[] = tagNames
    .map((tag) => {
      const b = bin.filter((r) => r.tags.includes(tag));
      const c = cont.filter((r) => r.tags.includes(tag));
      const logs = c.filter((r) => r.ratio != null);
      return {
        tag,
        binary: b.length
          ? {
              n: b.length,
              meanP: sum(b.map((r) => r.meanP)) / b.length,
              freq: sum(b.map((r) => r.outcome)) / b.length,
              brier: sum(b.map((r) => r.brier)) / b.length,
            }
          : null,
        continuous: c.length
          ? {
              n: c.length,
              hitRate: sum(c.map((r) => r.hit)) / c.length,
              targetRate: sum(c.map((r) => r.confidence)) / c.length,
              multiplier: logs.length ? Math.exp(sum(logs.map((r) => clampLogRatio(Math.log(r.ratio!)))) / logs.length) : null,
            }
          : null,
      };
    })
    .sort((a, b) => (b.binary?.n ?? 0) + (b.continuous?.n ?? 0) - ((a.binary?.n ?? 0) + (a.continuous?.n ?? 0)));

  return {
    counts: { binary: bin.length, continuous: cont.length, total: records.length },
    binary: summarizeBinary(bin.flatMap((r) => r.points)),
    continuous: summarizeContinuous(cont.flatMap((r) => r.points)),
    byType,
    tags,
  };
}

export interface TrendPoint {
  t: number;
  value: number;
  rolling: number;
  title: string;
  questionId: string;
}

/** Rolling mean over the last `window` resolved questions (or geometric mean for ratios). */
function rolling<R extends ScoredRecord>(records: R[], value: (r: R) => number, window: number, geometric = false): TrendPoint[] {
  const sorted = [...records].sort((a, b) => a.resolvedAt.getTime() - b.resolvedAt.getTime());
  const vals = sorted.map(value);
  return sorted.map((r, i) => {
    const slice = vals.slice(Math.max(0, i - window + 1), i + 1);
    const avg = geometric ? Math.exp(sum(slice.map((v) => clampLogRatio(Math.log(v)))) / slice.length) : sum(slice) / slice.length;
    return { t: r.resolvedAt.getTime(), value: vals[i], rolling: avg, title: r.title, questionId: r.questionId };
  });
}

export const TREND_WINDOW = 10;
export const brierTrend = (records: ScoredRecord[]) => rolling(records.filter(isBinary), (r) => r.brier, TREND_WINDOW);
export const hitRateTrend = (records: ScoredRecord[]) => rolling(records.filter(isContinuous), (r) => r.hit, TREND_WINDOW);
export const multiplierTrend = (records: ScoredRecord[]) =>
  rolling(
    records.filter(isContinuous).filter((r) => r.type === "duration" && r.ratio != null),
    (r) => r.ratio!,
    TREND_WINDOW,
    true,
  );

/**
 * Head-to-head skill on shared questions, relative to the median of everyone
 * else who forecast the same question (negative = better than the group).
 * Binary: Brier difference. Continuous: interval-score difference divided by
 * the others' median interval width, which makes it scale-free while staying
 * proper (the normaliser doesn't depend on your own forecast).
 */
export interface RelativeScore {
  userId: string;
  binary: { n: number; mean: number } | null;
  continuous: { n: number; mean: number } | null;
}

export function relativeScores(records: ScoredRecord[]): Map<string, RelativeScore> {
  const byQuestion = new Map<string, ScoredRecord[]>();
  for (const r of records) {
    const list = byQuestion.get(r.questionId) ?? [];
    list.push(r);
    byQuestion.set(r.questionId, list);
  }
  const acc = new Map<string, { b: number[]; c: number[] }>();
  const get = (u: string) => {
    let a = acc.get(u);
    if (!a) acc.set(u, (a = { b: [], c: [] }));
    return a;
  };
  for (const list of byQuestion.values()) {
    if (list.length < 2) continue;
    for (const r of list) {
      const others = list.filter((o) => o.userId !== r.userId);
      if (r.kind === "binary") {
        get(r.userId).b.push(r.brier - median(others.map((o) => (o as BinaryRecord).brier)));
      } else {
        const os = others as ContinuousRecord[];
        const scaleRef = median(os.map((o) => o.width));
        if (scaleRef > 0) get(r.userId).c.push((r.intervalScore - median(os.map((o) => o.intervalScore))) / scaleRef);
      }
    }
  }
  const out = new Map<string, RelativeScore>();
  for (const [userId, { b, c }] of acc) {
    out.set(userId, {
      userId,
      binary: b.length ? { n: b.length, mean: sum(b) / b.length } : null,
      continuous: c.length ? { n: c.length, mean: sum(c) / c.length } : null,
    });
  }
  return out;
}

/**
 * What the forecast composer needs to give "outside view" nudges. Plain data so
 * it can be passed to a client component.
 */
export interface ContinuousTrack extends AdjustmentModel {
  hitRate: number;
  targetRate: number;
  aboveMedian: number;
  multiplier: number | null;
}

export interface TrackRecord {
  binary: (Pick<RecalibrationFit, "a" | "b" | "n"> & { brier: number }) | null;
  continuous: Partial<Record<ContinuousType, ContinuousTrack>>;
  binaryByTag: Record<string, { n: number; meanP: number; freq: number }>;
  continuousByTag: Record<string, Partial<Record<ContinuousType, ContinuousTrack>>>;
}

export const MIN_BINARY_FOR_NUDGE = 8;
export const MIN_CONTINUOUS_FOR_NUDGE = 3;
export const MIN_TAG_FOR_NUDGE = 3;

function continuousTrack(records: ContinuousRecord[]): ContinuousTrack | null {
  const s = summarizeContinuous(records.flatMap((r) => r.points));
  if (!s) return null;
  return { ...s.adjustment, hitRate: s.hitRate, targetRate: s.targetRate, aboveMedian: s.aboveMedian, multiplier: s.multiplier };
}

export function buildTrackRecord(records: ScoredRecord[]): TrackRecord {
  const bin = records.filter(isBinary);
  const cont = records.filter(isContinuous);
  const binPoints = bin.flatMap((r) => r.points);
  const fit = binPoints.length ? fitRecalibration(binPoints) : null;

  const continuous: TrackRecord["continuous"] = {};
  for (const t of CONTINUOUS_TYPES) {
    const tr = continuousTrack(cont.filter((r) => r.type === t));
    if (tr && tr.n >= 1) continuous[t] = tr;
  }

  const binaryByTag: TrackRecord["binaryByTag"] = {};
  const continuousByTag: TrackRecord["continuousByTag"] = {};
  for (const tag of new Set(records.flatMap((r) => r.tags))) {
    const b = bin.filter((r) => r.tags.includes(tag));
    if (b.length) {
      binaryByTag[tag] = {
        n: b.length,
        meanP: sum(b.map((r) => r.meanP)) / b.length,
        freq: sum(b.map((r) => r.outcome)) / b.length,
      };
    }
    for (const t of CONTINUOUS_TYPES) {
      const tr = continuousTrack(cont.filter((r) => r.type === t && r.tags.includes(tag)));
      if (tr) (continuousByTag[tag] ??= {})[t] = tr;
    }
  }

  return {
    binary: fit ? { a: fit.a, b: fit.b, n: fit.n, brier: sum(bin.map((r) => r.brier)) / bin.length } : null,
    continuous,
    binaryByTag,
    continuousByTag,
  };
}

export { fitAdjustment };
