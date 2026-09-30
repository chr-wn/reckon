# Reckon

A small, shared prediction log for friends. Post a prediction — yes/no with a probability, or a range for *how long / how much / when* — resolve it later, and see honestly how well your confidence matches reality. One stream, public or private predictions, Google sign-in.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database setup: in development the app uses an embedded Postgres ([PGlite](https://pglite.dev)) stored in `./.data/pglite`, and `npm run dev` applies migrations automatically. Locally, `/login` shows **dev-login buttons** for every user, so you don't need Google to try things.

**Demo data** (optional — stop the dev server first; PGlite allows one process at a time):

```bash
npm run db:reset && npm run db:seed
```

Four friends with ~4 months of history, each with a different calibration personality — Ada is well calibrated, Ben overconfident, Cleo underconfident, Dev optimistic with a big planning fallacy.

## Going live (Supabase + Vercel)

Reckon talks to Postgres directly and has its own sessions, so from Supabase you only need the **database connection string** — no Supabase client or Supabase Auth. Any Postgres works.

1. **Database.** In Supabase: **Connect → Connection string → Transaction pooler** (port 6543). Replace `[YOUR-PASSWORD]` with your database password (URL-encode `@ : / # ?` etc.).
2. **Google sign-in.** In [Google Cloud Console](https://console.cloud.google.com/): create a project, open *Google Auth Platform* (the OAuth consent screen), set an app name and support email, choose audience **External**, and **Publish** the app — the basic `openid email profile` scopes don't need Google's review, whereas in "Testing" mode only listed test users can sign in. Then **Clients → Create client → Web application** with authorized redirect URI `https://<your-domain>/auth/google/callback` (add `http://localhost:3000/auth/google/callback` too if you want Google locally).
3. **Vercel environment variables** (*Settings → Environment Variables*):
   - `DATABASE_URL` — from step 1
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from step 2
   - `SIGNUP_CODE` *(optional)* — a new account's first sign-in needs this code; returning friends never do
4. **Deploy.** Production deploys apply migrations before building (`vercel-build`); preview deploys skip them so an unmerged branch can't change the shared schema. If your domain changes, update the redirect URI in Google (or set `APP_URL`).
5. **Match regions** (optional): set Vercel's function region to your Supabase region.

**Security note.** Supabase exposes the `public` schema through its Data API using a key that's public by design. Every table has row-level security enabled with no policies, and the API roles' privileges are revoked (migrations `0001`/`0002`), so nothing is readable that way; the app connects as the table owner and is unaffected. Keep `.enableRLS()` on any new table in `src/lib/db/schema.ts`.

**Migrating by hand**: put `DATABASE_URL=...` in `.env.production.local` (gitignored) and run `npm run db:migrate:prod`. Don't put it in `.env.local`, or `npm run dev` would use the real database.

## How it works

### Question types

| Type | Forecast | Stored as |
|---|---|---|
| `binary` | probability, 1–99% | `forecasts.probability` |
| `duration` | low / best guess / high at the question's confidence (default 80%), optional task timer | minutes; always log scale |
| `numeric` | low / best guess / high | raw numbers; linear or log scale |
| `date` | low / best guess / high, optionally with a time of day | epoch ms (local noon for a day; `unit = "datetime"` when times are used) |

The composer guesses the type from the wording ("How long…", "When…", "Will…") and parses deadlines ("by Friday", "tonight").

### Scoring (`src/lib/scoring/`)

- **Yes/no**: Brier score, calibration chart with Wilson 90% intervals, and a logistic recalibration fit (`P(yes) = σ(a + b·logit p)`, weak priors) behind the "your 90%s happen ~78% of the time" hints.
- **Ranges**: the three quantiles define a two-piece normal (log space for durations), giving every outcome a scale-free standardized error: hit rate vs. stated confidence, where reality landed (PIT), bias, and the planning multiplier (actual ÷ guess, each task capped at 8×).
- **Time-weighting**: each forecast counts for as long as it stood; last-second updates don't help.
- **Scoreboard**: resolved public predictions only; "±" is Brier minus the median of everyone else on the same questions.

Tests: `npm test` (scoring, and the extension's Google Calendar parser).

### Visibility & sign-in

- Predictions are **public** (every signed-in user can see and forecast) or **private** (author only); enforced in SQL (`visibleTo()` in `src/lib/data/questions.ts`) and re-checked in every server action.
- Others' forecasts are hidden until you forecast (or forecasting closes: resolved, past its resolve-by date, or the task timer started). You still see who forecast and when. Comments are always visible, so keep them spoiler-free.
- Each question page has one **Activity** stream, oldest first: every forecast and update (with its reasoning), comments, and the resolution.
- Google sign-in is a plain OAuth 2.0 + PKCE flow (`src/lib/auth/google.ts`, `src/app/auth/google/*`) feeding the app's own DB-backed sessions.

### Chrome extension

`extension/`: a keyboard-first composer you can open on any page (⌃⇧R), plus a Google Calendar hook that turns an event into “Will I finish ‹event› within ‹its length›?”. It reuses the web composer and posts through two JSON routes, `GET /api/me` and `POST /api/questions`, authenticated by the normal session cookie. See [extension/README.md](extension/README.md).

The composer (web and extension) is keyboard-driven: ⌥Y / ⌥L / ⌥M / ⌥W pick the question type, ⌥1–5 a deadline, ⌥P visibility, ⌘↵ posts, ⌥/ lists the rest.

## Project layout

```
src/
  app/(auth)/login    Google sign-in page (plus dev logins locally)
  app/auth/           OAuth start/callback routes, dev login
  app/(app)/          home stream, q/[id], stats
  components/         UI primitives, charts, composer, forecast inputs
  lib/db/             Drizzle schema + clients (postgres-js with DATABASE_URL; PGlite in dev only)
  lib/auth/           Google OAuth, accounts, sessions (hashed tokens, httpOnly cookie)
  lib/data/           server-only queries (visibility rules live here)
  lib/actions/        server actions (zod-validated, permission-checked)
  lib/scoring/        pure scoring math + tests
  app/api/            JSON routes for the Chrome extension
extension/            Chrome extension (build with npm run ext:build)
scripts/              migrate.ts, seed.ts
drizzle/              SQL migrations (`npm run db:generate` after editing the schema)
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
| `npm run ext:build` / `npm run ext:zip` | build the Chrome extension into `extension/dist` / also zip it for the Web Store (`RECKON_URL=http://localhost:3000` to point it at a dev server) |

## Ideas

- Recurring questions ("asleep by midnight?" every day).
- Reminders when your predictions come due (email or a Discord bot).
- Multiple-choice questions; importing Fatebook history.
