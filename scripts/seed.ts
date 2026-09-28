/**
 * Seeds a local demo: four friends in a group with ~4 months of history, each
 * with a different calibration "personality", so every stats view has data.
 *
 *   npm run db:reset && npm run db:seed
 *
 * Demo accounts (LOCAL DEV ONLY): ada, ben, cleo, dev — password: reckon-demo
 * Refuses to run against DATABASE_URL unless you pass --force.
 */
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { openScriptDb } from "./env";
import * as t from "../src/lib/db/schema";
import { zForInterval } from "../src/lib/scoring/math";

const DEMO_PASSWORD = "reckon-demo";
const DAY = 864e5;
const MIN = 6e4;
const NOW = Date.now();

// ── deterministic randomness ────────────────────────────────────────────────
let seed = 20260927;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round5 = (p: number) => clamp(Math.round(p * 20) / 20, 0.02, 0.98);
const niceMinutes = (m: number) => Math.max(5, Math.round(m / (m > 120 ? 15 : 5)) * (m > 120 ? 15 : 5));
const Z80 = zForInterval(0.8);

// ── the cast ────────────────────────────────────────────────────────────────
interface Persona {
  username: string;
  displayName: string;
  /** binary: forecast log-odds = slope·truth + yesBias + noise */
  slope: number;
  yesBias: number;
  noise: number;
  /** continuous: actual/median = exp(bias + trueSd·ε); stated intervals assume statedSd */
  bias: number;
  trueSd: number;
  statedSd: number;
  drillHit: number;
}

const CAST: Persona[] = [
  { username: "ada", displayName: "Ada", slope: 1.0, yesBias: 0, noise: 0.35, bias: 0.08, trueSd: 0.3, statedSd: 0.33, drillHit: 0.77 },
  { username: "ben", displayName: "Ben", slope: 1.8, yesBias: 0.1, noise: 0.4, bias: 0.42, trueSd: 0.35, statedSd: 0.14, drillHit: 0.52 },
  { username: "cleo", displayName: "Cleo", slope: 0.62, yesBias: 0, noise: 0.3, bias: 0.15, trueSd: 0.3, statedSd: 0.55, drillHit: 0.9 },
  { username: "dev", displayName: "Dev", slope: 1.25, yesBias: 0.65, noise: 0.35, bias: 0.6, trueSd: 0.35, statedSd: 0.24, drillHit: 0.63 },
];

// ── question templates ──────────────────────────────────────────────────────
const COURSES = ["18.06", "6.006", "8.02", "orgo", "econ"];
const BOOKS = ["Dune", "The Precipice", "Middlemarch", "Thinking, Fast and Slow"];
const EVENTS = ["game night", "the potluck", "movie night", "the hike"];
const THINGS = ["landing page", "lab report", "API refactor", "club budget"];

const BINARY: { tag: string; title: () => string }[] = [
  { tag: "homework", title: () => `Will I finish the ${pick(COURSES)} problem set by ${pick(["Thursday", "Friday night", "Sunday"])}?` },
  { tag: "gym", title: () => `Will I go to the gym at least ${pick([2, 3, 4])} times this week?` },
  { tag: "sleep", title: () => "Will I be asleep before midnight tonight?" },
  { tag: "social", title: () => `Will more than ${pick([4, 5, 6])} people come to ${pick(EVENTS)}?` },
  { tag: "work", title: () => `Will the ${pick(THINGS)} be done by ${pick(["Friday", "the weekend", "Wednesday"])}?` },
  { tag: "reading", title: () => `Will I finish ${pick(BOOKS)} this month?` },
  { tag: "world", title: () => `Will it rain on ${pick(["Saturday", "Sunday", "Tuesday"])}?` },
  { tag: "world", title: () => "Will the home team win this weekend?" },
];

const DURATIONS: { tag: string; title: () => string; base: number }[] = [
  { tag: "homework", title: () => `How long will the ${pick(COURSES)} pset take?`, base: 180 },
  { tag: "errands", title: () => "How long will the grocery run take, door to door?", base: 50 },
  { tag: "errands", title: () => "How long will laundry take, start to folded?", base: 110 },
  { tag: "work", title: () => `How long will the ${pick(["login bug fix", "slide deck", "code review", "lab write-up"])} take?`, base: 100 },
  { tag: "reading", title: () => `How long will chapter ${Math.floor(rand() * 20) + 1} take to read?`, base: 45 },
];

const NUMERICS: { tag: string; title: string; unit: string; scale: "linear" | "log"; base: number; sd: number }[] = [
  { tag: "sleep", title: "How many hours will I sleep tonight?", unit: "hours", scale: "linear", base: 7, sd: 0.9 },
  { tag: "money", title: "How much will I spend on food this week?", unit: "$", scale: "log", base: 95, sd: 0.3 },
  { tag: "work", title: "How many pages will I write today?", unit: "pages", scale: "log", base: 3, sd: 0.45 },
  { tag: "world", title: "What will tomorrow's high be?", unit: "°F", scale: "linear", base: 64, sd: 5 },
];

const COMMENTS = [
  "You're underestimating the write-up again 😅",
  "The forecast says 40%, I'm going 35.",
  "Last three times this took way longer than planned.",
  "Bold. I like it.",
  "Base rate for this crew showing up is like 60%.",
  "Remember the time the dryer ate an hour?",
];

async function main() {
  if (process.env.DATABASE_URL && !process.argv.includes("--force")) {
    console.error("✗ DATABASE_URL is set — refusing to seed a real database. Pass --force if you really mean it.");
    process.exit(1);
  }
  const { db, close } = openScriptDb();
  try {
    const [existing] = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.username, "ada")).limit(1);
    if (existing) {
      console.log("Demo data already exists. For a fresh start: npm run db:reset && npm run db:seed");
      return;
    }

    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const users = await db
      .insert(t.users)
      .values(CAST.map((c) => ({ username: c.username, displayName: c.displayName, passwordHash, timezone: "America/New_York", createdAt: new Date(NOW - 130 * DAY) })))
      .returning();
    const idOf = new Map(users.map((u) => [u.username, u.id]));
    const personaOf = new Map(CAST.map((c) => [idOf.get(c.username)!, c]));

    const [group] = await db
      .insert(t.groups)
      .values({ name: "Study Buddies", description: "Dorm floor forecasting league", inviteCode: "demo-invite", createdBy: idOf.get("ada")!, createdAt: new Date(NOW - 125 * DAY) })
      .returning();
    await db.insert(t.groupMembers).values(users.map((u, i) => ({ groupId: group.id, userId: u.id, role: i === 0 ? ("owner" as const) : ("member" as const), joinedAt: new Date(NOW - (125 - i) * DAY) })));

    let questionCount = 0;
    let forecastCount = 0;
    const sharedIds: string[] = [];

    type NewQ = typeof t.questions.$inferInsert;
    type NewF = typeof t.forecasts.$inferInsert;

    async function insertQuestion(q: NewQ, fs: Omit<NewF, "questionId">[], shared: boolean) {
      const [row] = await db.insert(t.questions).values(q).returning({ id: t.questions.id });
      if (shared) {
        await db.insert(t.questionGroups).values({ questionId: row.id, groupId: group.id });
        sharedIds.push(row.id);
      }
      if (fs.length) await db.insert(t.forecasts).values(fs.map((f) => ({ ...f, questionId: row.id })));
      questionCount++;
      forecastCount += fs.length;
      return row.id;
    }

    const others = (authorId: string) => users.filter((u) => u.id !== authorId && chance(0.6));

    for (const author of users) {
      const P = personaOf.get(author.id)!;

      // Binary history
      for (let i = 0; i < 34; i++) {
        const tpl = pick(BINARY);
        const created = NOW - (4 + rand() * 112) * DAY;
        const horizon = (1 + rand() * 8) * DAY;
        const truth = normal() * 1.5;
        const outcome = rand() < sigmoid(truth);
        const resolvedAt = created + horizon + rand() * 0.5 * DAY;
        const shared = chance(0.5);
        const forecastOf = (p: Persona, at: number): Omit<NewF, "questionId"> => ({
          userId: idOf.get(p.username)!,
          probability: round5(sigmoid(p.slope * truth + p.yesBias + p.noise * normal())),
          createdAt: new Date(at),
        });
        const fs = [forecastOf(P, created)];
        if (chance(0.25)) {
          const first = fs[0].probability!;
          fs.push({ userId: author.id, probability: round5(first + ((outcome ? 1 : 0) - first) * 0.4), createdAt: new Date(created + horizon * 0.6), note: "Updating on new info." });
        }
        if (shared) for (const o of others(author.id)) fs.push(forecastOf(personaOf.get(o.id)!, created + rand() * horizon * 0.5));
        await insertQuestion(
          {
            authorId: author.id,
            type: "binary",
            title: tpl.title(),
            tags: [tpl.tag],
            closesAt: new Date(created + horizon),
            resolvedAt: resolvedAt < NOW ? new Date(resolvedAt) : null,
            resolution: resolvedAt < NOW ? (outcome ? "yes" : "no") : null,
            createdAt: new Date(created),
          },
          fs,
          shared,
        );
      }

      // Duration history — the planning fallacy, personalised
      for (let i = 0; i < 18; i++) {
        const tpl = pick(DURATIONS);
        const created = NOW - (2 + rand() * 110) * DAY;
        const guessOf = (p: Persona, outsider: boolean) => tpl.base * Math.exp(-(outsider ? p.bias * 0.35 : p.bias) + 0.25 * normal());
        const median = niceMinutes(guessOf(P, false));
        const actual = Math.max(3, median * Math.exp(P.bias + P.trueSd * normal()));
        const quant = (p: Persona, g: number) => ({
          low: niceMinutes(g * Math.exp(-Z80 * p.statedSd * (0.8 + 0.4 * rand()))),
          median: niceMinutes(g),
          high: niceMinutes(g * Math.exp(Z80 * p.statedSd * (0.9 + 0.5 * rand()))),
        });
        const fix = (q: { low: number; median: number; high: number }) => ({ low: Math.min(q.low, q.median - 1), median: q.median, high: Math.max(q.high, q.median + 1) });
        const startAt = created + (0.2 + rand()) * DAY;
        const shared = chance(0.4);
        const fs: Omit<NewF, "questionId">[] = [{ userId: author.id, ...fix(quant(P, median)), createdAt: new Date(created) }];
        if (shared) {
          for (const o of others(author.id)) {
            const op = personaOf.get(o.id)!;
            fs.push({ userId: o.id, ...fix(quant(op, guessOf(op, true))), createdAt: new Date(created + rand() * (startAt - created)) });
          }
        }
        const resolvedAt = startAt + actual * MIN;
        await insertQuestion(
          {
            authorId: author.id,
            type: "duration",
            title: tpl.title(),
            tags: [tpl.tag],
            unit: tpl.base >= 120 ? "hours" : "minutes",
            scale: "log",
            confidence: 0.8,
            workStartedAt: new Date(startAt),
            timerAccumulatedMs: actual * MIN,
            resolvedAt: new Date(resolvedAt),
            resolution: "value",
            resolutionValue: Math.round(actual),
            resolutionNote: actual > fs[0].high! ? pick(["Forgot about the write-up.", "Got distracted halfway.", "The last problem was brutal."]) : null,
            createdAt: new Date(created),
          },
          fs,
          shared,
        );
      }

      // Numeric history
      for (let i = 0; i < 9; i++) {
        const tpl = pick(NUMERICS);
        const created = NOW - (3 + rand() * 100) * DAY;
        const horizon = (1 + rand() * 5) * DAY;
        const log = tpl.scale === "log";
        const g = log ? tpl.base * Math.exp(0.3 * normal()) : tpl.base + tpl.sd * 0.5 * normal();
        const width = P.statedSd / 0.33; // relative to a calibrated forecaster
        const q = log
          ? { low: g * Math.exp(-Z80 * tpl.sd * width), median: g, high: g * Math.exp(Z80 * tpl.sd * width) }
          : { low: g - Z80 * tpl.sd * width, median: g, high: g + Z80 * tpl.sd * width };
        const r2 = (x: number) => Math.round(x * 10) / 10;
        const actual = log ? g * Math.exp(tpl.sd * normal()) : g + tpl.sd * normal();
        await insertQuestion(
          {
            authorId: author.id,
            type: "numeric",
            title: tpl.title,
            tags: [tpl.tag],
            unit: tpl.unit,
            scale: tpl.scale,
            confidence: 0.8,
            closesAt: new Date(created + horizon),
            resolvedAt: new Date(created + horizon),
            resolution: "value",
            resolutionValue: r2(actual),
            createdAt: new Date(created),
          },
          [{ userId: author.id, low: r2(q.low), median: r2(q.median), high: r2(q.high), createdAt: new Date(created) }],
          false,
        );
      }

      // Date history: package arrivals, finishing books
      for (let i = 0; i < 5; i++) {
        const created = NOW - (15 + rand() * 90) * DAY;
        const expectedDays = chance(0.5) ? 4 : 18;
        const noon = (ms: number) => {
          const d = new Date(ms);
          d.setHours(12, 0, 0, 0);
          return d.getTime();
        };
        const med = noon(created + expectedDays * DAY);
        const spread = expectedDays * 0.35 * (P.statedSd / 0.33);
        const actual = noon(med + (P.bias * expectedDays * 0.5 + expectedDays * 0.3 * normal()) * DAY);
        await insertQuestion(
          {
            authorId: author.id,
            type: "date",
            title: expectedDays < 10 ? "When will my package arrive?" : `When will I finish reading ${pick(BOOKS)}?`,
            tags: [expectedDays < 10 ? "errands" : "reading"],
            confidence: 0.8,
            resolvedAt: new Date(Math.min(NOW - DAY, actual)),
            resolution: "value",
            resolutionValue: Math.min(noon(NOW - DAY), actual),
            createdAt: new Date(created),
          },
          [{ userId: author.id, low: noon(med - Math.max(1, spread) * DAY), median: med, high: noon(med + Math.max(1, spread * 1.3) * DAY), createdAt: new Date(created) }],
          false,
        );
      }
    }

    // A few live questions: open, overdue, and one task being timed right now
    const ada = idOf.get("ada")!;
    const ben = idOf.get("ben")!;
    const cleo = idOf.get("cleo")!;
    await insertQuestion(
      { authorId: ben, type: "binary", title: "Will at least 5 people come to Saturday's game night?", tags: ["social"], closesAt: new Date(NOW + 3 * DAY), createdAt: new Date(NOW - DAY) },
      [
        { userId: ben, probability: 0.85, createdAt: new Date(NOW - DAY), note: "Everyone said they'd come!" },
        { userId: cleo, probability: 0.55, createdAt: new Date(NOW - 0.5 * DAY), note: "Everyone always says that." },
      ],
      true,
    );
    await insertQuestion(
      { authorId: cleo, type: "duration", title: "How long will my orgo lab report take?", tags: ["homework"], unit: "hours", scale: "log", confidence: 0.8, createdAt: new Date(NOW - 0.3 * DAY) },
      [{ userId: cleo, low: 150, median: 240, high: 420, createdAt: new Date(NOW - 0.3 * DAY) }],
      true,
    );
    await insertQuestion(
      { authorId: ada, type: "binary", title: "Will I finish the 6.006 problem set by Friday night?", tags: ["homework"], closesAt: new Date(NOW + 4 * DAY), createdAt: new Date(NOW - 2 * 36e5) },
      [{ userId: ada, probability: 0.7, createdAt: new Date(NOW - 2 * 36e5) }],
      true,
    );
    await insertQuestion(
      { authorId: ada, type: "binary", title: "Will I get to the gym 3 times this week?", tags: ["gym"], closesAt: new Date(NOW - 0.5 * DAY), createdAt: new Date(NOW - 6 * DAY) },
      [{ userId: ada, probability: 0.6, createdAt: new Date(NOW - 6 * DAY) }],
      false,
    );
    await insertQuestion(
      { authorId: ada, type: "numeric", title: "How much will I spend on food this week?", tags: ["money"], unit: "$", scale: "log", confidence: 0.8, closesAt: new Date(NOW - 0.2 * DAY), createdAt: new Date(NOW - 7 * DAY) },
      [{ userId: ada, low: 60, median: 85, high: 120, createdAt: new Date(NOW - 7 * DAY) }],
      false,
    );
    await insertQuestion(
      {
        authorId: ada,
        type: "duration",
        title: "How long will the 18.06 pset take?",
        tags: ["homework"],
        unit: "hours",
        scale: "log",
        confidence: 0.8,
        workStartedAt: new Date(NOW - 25 * MIN),
        timerRunningSince: new Date(NOW - 25 * MIN),
        createdAt: new Date(NOW - 40 * MIN),
      },
      [{ userId: ada, low: 90, median: 150, high: 240, createdAt: new Date(NOW - 40 * MIN) }],
      false,
    );
    await insertQuestion(
      { authorId: idOf.get("dev")!, type: "date", title: "When will we get the club budget approved?", tags: ["work"], confidence: 0.8, createdAt: new Date(NOW - 2 * DAY) },
      [{ userId: idOf.get("dev")!, low: NOW + 2 * DAY, median: NOW + 6 * DAY, high: NOW + 12 * DAY, createdAt: new Date(NOW - 2 * DAY) }],
      true,
    );

    // Banter
    for (const qid of sharedIds.slice(0, 40)) {
      if (!chance(0.35)) continue;
      const u = pick(users);
      await db.insert(t.comments).values({ questionId: qid, userId: u.id, body: pick(COMMENTS), createdAt: new Date(NOW - rand() * 100 * DAY) });
    }

    // Drill history (synthetic item keys; real rounds use the fact bank)
    for (const u of users) {
      const P = personaOf.get(u.id)!;
      const rows: (typeof t.drillAttempts.$inferInsert)[] = [];
      for (let i = 0; i < 70; i++) {
        const at = new Date(NOW - (1 + rand() * 60) * DAY);
        const roundId = `seed-${u.username}-${Math.floor(i / 10)}`;
        if (i % 5 < 3) {
          const hit = chance(P.drillHit + (i > 40 ? 0.05 : 0));
          rows.push({ userId: u.id, roundId, itemKey: `seed-${i}`, kind: "interval", confidence: 0.8, low: 0, high: 1, answer: hit ? 0.5 : 2, correct: hit, createdAt: at });
        } else {
          const truth = normal() * 1.2;
          const pA = clamp(round5(sigmoid(P.slope * truth + P.noise * normal())), 0.05, 0.95);
          const aRight = rand() < sigmoid(truth);
          rows.push({
            userId: u.id,
            roundId,
            itemKey: `seed-cmp-${i}`,
            kind: "compare",
            probability: pA,
            answer: aRight ? 1 : 0,
            correct: (pA >= 0.5) === aRight,
            createdAt: at,
          });
        }
      }
      await db.insert(t.drillAttempts).values(rows);
    }

    console.log(`✓ Seeded ${users.length} demo users, 1 group, ${questionCount} questions, ${forecastCount} forecasts.`);
    console.log(`  Log in as ada, ben, cleo or dev — password: ${DEMO_PASSWORD} (local demo only).`);
    console.log(`  Group invite link: /invite/demo-invite`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("✗ seed failed:", err);
  process.exit(1);
});
