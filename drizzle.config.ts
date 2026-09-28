import { defineConfig } from "drizzle-kit";

// Only used for `npm run db:generate` (diffing the schema into SQL migrations).
// Applying migrations is done by scripts/migrate.ts, which handles both the
// embedded PGlite database and a real Postgres (e.g. Supabase) via DATABASE_URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
