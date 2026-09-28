import { COMPARE_GROUPS, FACTS, type Fact } from "./facts";

/**
 * Drill items are generated from the fact bank:
 *   interval — "In what year…?" → give a range at the round's confidence
 *   compare  — two facts from the same comparison group → P(first option is right)
 * Answers never leave the server until an attempt is submitted.
 */
export type DrillMode = "mixed" | "interval" | "compare";

export type DrillItem =
  | { kind: "interval"; key: string; question: string; unit: string | null; isYear: boolean; category: string }
  | { kind: "compare"; key: string; prompt: string; a: string; b: string; category: string };

const byId = new Map(FACTS.map((f) => [f.id, f]));
const groups = new Map<string, Fact[]>();
for (const f of FACTS) {
  if (!f.cmp) continue;
  const list = groups.get(f.cmp) ?? [];
  list.push(f);
  groups.set(f.cmp, list);
}

export const FACT_COUNT = FACTS.length;

/** Pairs too close to call from measurement fuzz alone (or exact ties) are skipped. */
function comparable(a: Fact, b: Fact): boolean {
  if (a.answer === b.answer) return false;
  if (a.kind === "year") return true;
  const scale = Math.max(Math.abs(a.answer), Math.abs(b.answer));
  return Math.abs(a.answer - b.answer) / (scale || 1) >= 0.005;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function toItem(key: string): DrillItem | null {
  if (key.includes("|")) {
    const [ida, idb] = key.split("|");
    const a = byId.get(ida);
    const b = byId.get(idb);
    if (!a || !b || !a.cmp || a.cmp !== b.cmp || !comparable(a, b)) return null;
    return { kind: "compare", key, prompt: COMPARE_GROUPS[a.cmp].prompt, a: a.label, b: b.label, category: a.cat };
  }
  const f = byId.get(key);
  if (!f) return null;
  return { kind: "interval", key, question: f.q, unit: f.unit ?? null, isYear: f.kind === "year", category: f.cat };
}

/** Picks a round, preferring facts the user hasn't seen (least-recently-seen first after that). */
export function pickRound(mode: DrillMode, seen: Map<string, number>, n = 10): DrillItem[] {
  const nInterval = mode === "interval" ? n : mode === "compare" ? 0 : Math.ceil(n / 2);
  const nCompare = n - nInterval;
  const lastSeen = (id: string) => seen.get(id) ?? -1;
  const usedFacts = new Set<string>();
  const items: DrillItem[] = [];

  // Interval items: unseen first, then oldest-seen, randomized within ties.
  const intervalPool = shuffle(FACTS).sort((a, b) => lastSeen(a.id) - lastSeen(b.id));
  for (const f of intervalPool) {
    if (items.length >= nInterval) break;
    usedFacts.add(f.id);
    items.push(toItem(f.id)!);
  }

  // Comparisons: rotate through groups for variety; avoid reusing a fact within the round.
  const groupKeys = shuffle([...groups.keys()]);
  let guard = 0;
  while (items.length < nInterval + nCompare && guard++ < 500) {
    const g = groups.get(groupKeys[guard % groupKeys.length])!;
    const candidates = shuffle(g.filter((f) => !usedFacts.has(f.id)));
    let best: [Fact, Fact] | null = null;
    let bestSeen = Infinity;
    for (let i = 0; i < candidates.length && i < 12; i++) {
      for (let j = i + 1; j < candidates.length && j < 12; j++) {
        const [a, b] = [candidates[i], candidates[j]];
        if (!comparable(a, b)) continue;
        const s = Math.max(lastSeen(`${a.id}|${b.id}`), lastSeen(`${b.id}|${a.id}`));
        if (s < bestSeen) {
          best = [a, b];
          bestSeen = s;
        }
      }
    }
    if (!best) continue;
    const [a, b] = Math.random() < 0.5 ? best : [best[1], best[0]];
    usedFacts.add(a.id).add(b.id);
    items.push(toItem(`${a.id}|${b.id}`)!);
  }
  return shuffle(items);
}

export interface IntervalResult {
  kind: "interval";
  correct: boolean;
  answer: number;
  unit: string | null;
  isYear: boolean;
  note: string | null;
}

export interface CompareResult {
  kind: "compare";
  correct: boolean;
  /** true if the first option was the right answer */
  firstRight: boolean;
  aValue: number;
  bValue: number;
  unit: string | null;
  isYear: boolean;
  note: string | null;
}

export function scoreInterval(key: string, low: number, high: number): IntervalResult | null {
  const f = byId.get(key);
  if (!f) return null;
  const [lo, hi] = low <= high ? [low, high] : [high, low];
  return { kind: "interval", correct: f.answer >= lo && f.answer <= hi, answer: f.answer, unit: f.unit ?? null, isYear: f.kind === "year", note: f.note ?? null };
}

export function scoreCompare(key: string, pFirst: number): CompareResult | null {
  const item = toItem(key);
  if (!item || item.kind !== "compare") return null;
  const [a, b] = key.split("|").map((id) => byId.get(id)!);
  const higherWins = COMPARE_GROUPS[a.cmp!].higherWins;
  const firstRight = higherWins ? a.answer > b.answer : a.answer < b.answer;
  // Leaning at exactly 50% counts as picking the first option.
  const pickedFirst = pickedFirstOption(pFirst);
  return {
    kind: "compare",
    correct: pickedFirst === firstRight,
    firstRight,
    aValue: a.answer,
    bValue: b.answer,
    unit: a.unit ?? null,
    isYear: a.kind === "year",
    note: (firstRight ? a.note : b.note) ?? null,
  };
}

export const pickedFirstOption = (pFirst: number) => pFirst >= 0.5;

const numFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function fmtFact(value: number, unit: string | null, isYear: boolean): string {
  if (isYear) return value < 0 ? `${-value} BC` : String(value);
  const n = numFmt.format(value).replace("-", "−");
  if (!unit) return n;
  return unit.startsWith("°") ? `${n}${unit}` : `${n} ${unit}`;
}
