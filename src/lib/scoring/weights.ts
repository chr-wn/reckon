export interface Weighted<T> {
  item: T;
  weight: number;
}

/**
 * Time-weighted scoring: each of a user's forecasts on a question counts in
 * proportion to how long it was their standing forecast, from their first
 * forecast until the scoring window closes. Weights sum to 1.
 *
 * This makes a last-minute update ("I finished, so 99%!") nearly worthless,
 * while still rewarding people who update well as evidence comes in.
 */
export function timeWeighted<T extends { createdAt: Date }>(forecasts: T[], end: Date): Weighted<T>[] {
  if (forecasts.length === 0) return [];
  const sorted = [...forecasts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const endMs = end.getTime();
  const durations = sorted.map((f, i) => {
    const start = f.createdAt.getTime();
    const next = i + 1 < sorted.length ? sorted[i + 1].createdAt.getTime() : endMs;
    return Math.max(0, Math.min(next, endMs) - start);
  });
  const total = durations.reduce((s, d) => s + d, 0);
  if (total > 0) {
    return sorted.map((item, i) => ({ item, weight: durations[i] / total })).filter((x) => x.weight > 0);
  }
  // Degenerate window (everything made at/after the end): use the last forecast
  // made at or before the end, otherwise the first one.
  const before = sorted.filter((f) => f.createdAt.getTime() <= endMs);
  return [{ item: before.length ? before[before.length - 1] : sorted[0], weight: 1 }];
}

/** When forecasting stops counting for a question. */
export function scoringWindowEnd(q: {
  resolvedAt: Date | null;
  closesAt: Date | null;
  workStartedAt: Date | null;
}): Date | null {
  const candidates = [q.resolvedAt, q.closesAt, q.workStartedAt].filter((d): d is Date => d != null);
  if (!q.resolvedAt || candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}
