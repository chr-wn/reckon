# Reckon

A calibration gym for friends. Make predictions — yes/no with a probability, or a range for *how long / how much / when* — resolve them, and see honestly how well your confidence matches reality. Forecast on each other's questions, compare on the same questions, and train with instant-feedback drills.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database setup: in development the app uses an embedded Postgres ([PGlite](https://pglite.dev)) stored in `./.data/pglite`, and `npm run dev` applies migrations automatically.

**Demo data** (optional — stop the dev server first; PGlite allows one process at a time):

```bash
npm run db:reset && npm run db:seed
```

This creates four friends in a group ("Study Buddies") with ~4 months of history, each with a different calibration personality — Ada is well calibrated, Ben is overconfident, Cleo underconfident, Dev optimistic with a big planning fallacy. Log in as `ada`, `ben`, `cleo` or `dev` with password `reckon-demo` (local demo only). Invite link: `/invite/demo-invite`.

## Going live (Supabase + Vercel)

Reckon talks to Postgres directly and has its own auth (username + password, sessions stored in Postgres), so from Supabase you only need the **database connection string** — no `@supabase/supabase-js`, no Supabase Auth, no API keys. Any Postgres works (Neon, Railway, RDS…).

1. **Get the connection string.** In the Supabase dashboard: **Connect → Connection string → Transaction pooler** (port 6543 — works from serverless, IPv4). Replace `[YOUR-PASSWORD]` with your database password (reset it under *Database settings* if you've lost it). URL-encode the password if it contains `@ : / # ?` etc.
2. **Import the repo in Vercel** (*Add New → Project*). Next.js is auto-detected. Before the first deploy, add environment variables:
   - `DATABASE_URL` — the string from step 1 (Production; add it to Preview too if you want preview deploys to work)
   - `SIGNUP_CODE` *(recommended)* — new accounts need this code unless they arrive through a group invite link
3. **Deploy.** The `vercel-build` script applies migrations before `next build`, on production deploys only (preview deploys skip them so an unmerged branch can't change the shared schema).
4. **Match regions** (optional but snappier): set the Vercel function region (*Settings → Functions*) to your Supabase region — e.g. `iad1` for US East.

After that, every push to `main` redeploys (and migrates) automatically.

**Security note.** Supabase exposes the `public` schema through its Data API using a key that's public by design. Migrations `0001`/`0002` turn on row-level security for every table (with no policies) and revoke the API roles' privileges, so nothing is readable or writable that way — the app itself connects as the table owner and is unaffected. Keep `.enableRLS()` on any new table in `src/lib/db/schema.ts`.

**Migrating by hand**: put `DATABASE_URL=...` in `.env.production.local` (gitignored) and run `npm run db:migrate:prod`. Don't put it in `.env.local`, or `npm run dev` would use the real database.

**Free-tier note**: Supabase pauses free projects after a week without activity; unpause from the dashboard.

## How it works

The in-app **Learn** page (`/learn`) explains all of this for users; here's the implementer's version.

### Question types

| Type | Forecast | Stored as |
|---|---|---|
| `binary` | probability, 1–99% | `forecasts.probability` |
| `duration` | low / best guess / high at the question's confidence (default 80%) | minutes; always log scale |
| `numeric` | low / best guess / high | raw numbers; linear or log scale (per question) |
| `date` | low / best guess / high | epoch ms (local noon) |

Range inputs ask for each tail separately ("10% chance it's lower than…") because eliciting bounds separately yields better-calibrated intervals than asking for a range in one go.

### Scoring (`src/lib/scoring/`)

- **Binary**: Brier score. Calibration chart with 11 centred bins and Wilson 90% intervals. A logistic *recalibration* fit, `P(yes) = σ(a + b·logit p)`, with weak priors, drives the verdict (b < 1 ⇒ overconfident) and the "your 90%s happen ~78% of the time" nudges.
- **Ranges**: the three quantiles define a *two-piece normal* in scoring space (log space for ratio-like quantities) that matches them exactly. Every outcome gets a standardized error `z` — comparable across questions of any scale. From that: hit rate vs. stated confidence, PIT histogram ("where reality landed"), bias (share above the median), and for durations the planning multiplier (geometric mean of actual ÷ guess, each task capped at 8× so one accidental timer doesn't dominate).
- **Time-weighting**: each forecast counts for the share of the window it was standing (first forecast → min(close, resolve, timer start)). Last-second updates don't help.
- **Relative scores** (group leaderboards): your score minus the median of everyone else on the *same* question. Binary uses Brier; ranges use the Gneiting–Raftery interval score normalized by the others' median width — scale-free and still proper.
- **Outside-view adjustment**: across your resolved range questions, `z ~ N(bias, spread²)`, shrunk toward N(0,1) with a 2-question prior. A new forecast is re-expressed through that model to suggest a calibrated range ("Use this").

Tests: `npm test` (scoring math, time weighting, recalibration, adjustment).

### Social mechanics

- Questions are private or shared with one or more groups; visibility is enforced in SQL (`visibleTo()` in `src/lib/data/questions.ts`) and re-checked in every server action.
- Others' forecasts **and comments** are hidden until you forecast (or forecasting closes) — anti-anchoring.
- Profiles are visible to people you share a group with, and only include questions you can both see.

### Drills

`src/lib/drills/facts.ts` holds 233 fact-checked trivia facts (sources in the file header). Rounds mix range questions and "which is bigger/earlier?" comparisons generated from comparison groups; answers are only revealed server-side after submission. Drill stats are kept separate from real-world calibration.

## Project layout

```
src/
  app/(auth)/         login, signup
  app/(app)/          dashboard, questions, q/[id], new, groups, invite, stats, u/[username], drills, learn, settings
  components/         UI primitives, charts (SVG, CVD-validated palette), composer, forecast inputs
  lib/db/             Drizzle schema + clients (postgres-js with DATABASE_URL; PGlite in dev only)
  lib/auth/           scrypt password hashing, DB-backed sessions (hashed tokens, httpOnly cookie)
  lib/data/           server-only queries (visibility rules live here)
  lib/actions/        server actions (all validate with zod and check permissions)
  lib/scoring/        pure scoring math + tests
  lib/drills/         fact bank + round generation
scripts/              migrate.ts, seed.ts
drizzle/              SQL migrations (generate with `npm run db:generate` after editing the schema)
```

## Scripts

| | |
|---|---|
| `npm run dev` | migrate + dev server |
| `npm test` | scoring unit tests |
| `npm run typecheck` / `npm run lint` | |
| `npm run db:generate` | diff `schema.ts` into a new SQL migration |
| `npm run db:migrate` | apply migrations locally (PGlite, or `DATABASE_URL` if set) |
| `npm run db:migrate:prod` | apply migrations using `.env.production.local` |
| `npm run db:seed` | demo data (refuses to touch `DATABASE_URL` without `--force`) |
| `npm run db:reset` | wipe the local PGlite database |

## Ideas for next iterations

- **Recurring questions** ("Will I be asleep by midnight?" every day) — the fastest way to build a big personal sample.
- **Reminders** when questions close (email, Discord or Telegram bot), and a weekly group digest.
- **Multiple-choice questions** and a draw-your-distribution input.
- **Import from Fatebook** (it has an API) so existing history counts.
- **Group-contributed drill facts**, and drills built from your own resolved questions ("guess what you guessed").
- **Early-vs-late fairness** in relative scores (people who forecast later know more).
- OAuth / magic-link login, login rate limiting, PWA install.
