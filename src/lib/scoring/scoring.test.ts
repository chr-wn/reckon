import { describe, expect, it } from "vitest";
import { binIndex, calibrationBins, fitRecalibration, recalibrate, summarizeBinary, type BinaryPoint } from "./binary";
import {
  applyAdjustment,
  fitAdjustment,
  intervalScore,
  standardizedError,
  summarizeContinuous,
  type ContinuousPoint,
} from "./continuous";
import { normCdf, normInv, wilson, zForInterval } from "./math";
import { relativeScores, scoreQuestion, type ScoringQuestion } from "./records";
import { scoringWindowEnd, timeWeighted } from "./weights";

// Deterministic PRNG so the statistical tests are stable.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("math", () => {
  it("normal quantiles and CDF round-trip", () => {
    expect(normInv(0.5)).toBeCloseTo(0, 8);
    expect(normInv(0.975)).toBeCloseTo(1.959964, 5);
    expect(zForInterval(0.8)).toBeCloseTo(1.281552, 5);
    expect(zForInterval(0.9)).toBeCloseTo(1.644854, 5);
    for (const p of [0.001, 0.02, 0.3, 0.5, 0.77, 0.99]) expect(normCdf(normInv(p))).toBeCloseTo(p, 6);
  });

  it("wilson interval brackets the sample proportion", () => {
    const [lo, hi] = wilson(7, 10);
    expect(lo).toBeLessThan(0.7);
    expect(hi).toBeGreaterThan(0.7);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});

describe("time weighting", () => {
  const t = (h: number) => new Date(Date.UTC(2026, 0, 1, h));

  it("weights forecasts by how long they stood", () => {
    const w = timeWeighted([{ createdAt: t(0) }, { createdAt: t(3) }], t(4));
    expect(w.map((x) => x.weight)).toEqual([0.75, 0.25]);
  });

  it("ignores time after the window closes and handles degenerate windows", () => {
    const w = timeWeighted([{ createdAt: t(0) }, { createdAt: t(10) }], t(4));
    expect(w).toHaveLength(1);
    expect(w[0].weight).toBe(1);
    const late = timeWeighted([{ createdAt: t(5) }, { createdAt: t(6) }], t(4));
    expect(late[0].item.createdAt).toEqual(t(5));
  });

  it("window ends at the earliest of resolve / close / work start", () => {
    expect(scoringWindowEnd({ resolvedAt: t(9), closesAt: t(5), workStartedAt: t(7) })).toEqual(t(5));
    expect(scoringWindowEnd({ resolvedAt: null, closesAt: t(5), workStartedAt: null })).toBeNull();
  });
});

describe("binary scoring", () => {
  it("bins round forecasts into centred buckets", () => {
    expect(binIndex(0.7)).toBe(7);
    expect(binIndex(0.15)).toBe(2);
    expect(binIndex(0.05)).toBe(1);
    expect(binIndex(0.94)).toBe(9);
    expect(binIndex(0.99)).toBe(10);
    const bins = calibrationBins([
      { p: 0.7, o: 1, w: 1 },
      { p: 0.7, o: 0, w: 1 },
      { p: 0.72, o: 1, w: 1 },
    ]);
    expect(bins[7].n).toBe(3);
    expect(bins[7].freq).toBeCloseTo(2 / 3);
  });

  it("recalibration detects overconfidence and leaves calibrated forecasters alone", () => {
    const r = rng(1);
    const over: BinaryPoint[] = [];
    const calibrated: BinaryPoint[] = [];
    for (let i = 0; i < 400; i++) {
      const p = 0.05 + 0.9 * r();
      // an overconfident forecaster: reality is only half as extreme (in log-odds) as their forecast
      const truth = 1 / (1 + Math.exp(-0.5 * Math.log(p / (1 - p))));
      over.push({ p, o: r() < truth ? 1 : 0, w: 1 });
      calibrated.push({ p, o: r() < p ? 1 : 0, w: 1 });
    }
    const fo = fitRecalibration(over);
    const fc = fitRecalibration(calibrated);
    expect(fo.b).toBeLessThan(0.7);
    expect(Math.abs(fc.b - 1)).toBeLessThan(0.25);
    expect(recalibrate(0.9, fo)).toBeLessThan(0.85);
    expect(summarizeBinary(over)!.verdict).toBe("overconfident");
  });
});

describe("continuous scoring", () => {
  const q = { low: 30, median: 45, high: 90 };

  it("maps the stated quantiles to ±z_c and 0", () => {
    const zc = zForInterval(0.8);
    expect(standardizedError(q, 45, 0.8, "log")).toBeCloseTo(0, 10);
    expect(standardizedError(q, 30, 0.8, "log")).toBeCloseTo(-zc, 10);
    expect(standardizedError(q, 90, 0.8, "log")).toBeCloseTo(zc, 10);
    expect(standardizedError(q, 90, 0.8, "linear")).toBeCloseTo(zc, 10);
  });

  it("interval score is width inside, penalised outside", () => {
    expect(intervalScore(q, 50, 0.8, "linear")).toBeCloseTo(60);
    expect(intervalScore(q, 100, 0.8, "linear")).toBeCloseTo(60 + 10 * 10);
  });

  it("identity adjustment returns the same forecast", () => {
    const a = applyAdjustment(q, 0.8, "log", { n: 10, bias: 0, spread: 1 });
    expect(a.low).toBeCloseTo(30);
    expect(a.median).toBeCloseTo(45);
    expect(a.high).toBeCloseTo(90);
  });

  it("adjustment learns planning-fallacy bias (shrunk toward zero)", () => {
    const pts = [2, 2.4, 1.6, 2.2].map((z) => ({ z, w: 1 }));
    const m = fitAdjustment(pts);
    expect(m.bias).toBeGreaterThan(1);
    expect(m.bias).toBeLessThan(2.05);
    const adj = applyAdjustment(q, 0.8, "log", m);
    expect(adj.median).toBeGreaterThan(q.median);
    expect(adj.high).toBeGreaterThan(q.high);
  });

  it("summaries report coverage and the planning multiplier", () => {
    const pts: ContinuousPoint[] = [
      { z: 0.5, hit: 1, confidence: 0.8, w: 1, logRatio: Math.log(1.2), logWidth80: Math.log(3) },
      { z: 2.5, hit: 0, confidence: 0.8, w: 1, logRatio: Math.log(2), logWidth80: Math.log(2) },
    ];
    const s = summarizeContinuous(pts)!;
    expect(s.hitRate).toBe(0.5);
    expect(s.targetRate).toBe(0.8);
    expect(s.aboveMedian).toBe(1);
    expect(s.multiplier).toBeCloseTo(Math.sqrt(2.4));
  });
});

describe("question scoring", () => {
  const t = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
  const base: ScoringQuestion = {
    id: "q1",
    type: "binary",
    title: "Will it happen?",
    tags: ["x"],
    confidence: 0.8,
    scale: "linear",
    authorId: "a",
    resolution: "yes",
    resolutionValue: null,
    resolvedAt: t(10),
    closesAt: null,
    workStartedAt: null,
  };
  const f = (userId: string, h: number, extra: object) => ({
    questionId: "q1",
    userId,
    probability: null,
    low: null,
    median: null,
    high: null,
    createdAt: t(h),
    ...extra,
  });

  it("time-weights binary Brier and computes relative scores", () => {
    const recs = scoreQuestion(base, [
      f("a", 0, { probability: 0.6 }),
      f("a", 5, { probability: 1 }),
      f("b", 0, { probability: 0.2 }),
    ]);
    const a = recs.find((r) => r.userId === "a")!;
    expect(a.kind).toBe("binary");
    if (a.kind === "binary") expect(a.brier).toBeCloseTo(0.5 * 0.16 + 0.5 * 0);
    const rel = relativeScores(recs);
    expect(rel.get("a")!.binary!.mean).toBeLessThan(0);
    expect(rel.get("b")!.binary!.mean).toBeGreaterThan(0);
  });

  it("skips ambiguous and scores durations in log space", () => {
    expect(scoreQuestion({ ...base, resolution: "ambiguous" }, [f("a", 0, { probability: 0.5 })])).toEqual([]);
    const recs = scoreQuestion({ ...base, type: "duration", resolution: "value", resolutionValue: 90 }, [
      f("a", 0, { low: 30, median: 45, high: 60 }),
    ]);
    const r = recs[0];
    expect(r.kind).toBe("continuous");
    if (r.kind === "continuous") {
      expect(r.hit).toBe(0);
      expect(r.ratio).toBeCloseTo(2);
      expect(r.z).toBeGreaterThan(zForInterval(0.8));
    }
  });
});
