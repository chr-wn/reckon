/**
 * Applies the SQL migrations in ./drizzle to whichever database the environment
 * points at (see scripts/env.ts). Runs automatically on production deploys via
 * the `vercel-build` script.
 */
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { openScriptDb } from "./env";

async function main() {
  // Preview deployments share the production database; never migrate it from an unmerged branch.
  if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
    console.log(`↷ skipping migrations for a ${process.env.VERCEL_ENV ?? "non-production"} deployment`);
    return;
  }
  const handle = openScriptDb();
  try {
    if (handle.kind === "pglite") {
      await migratePglite(handle.db as unknown as PgliteDatabase, { migrationsFolder: "drizzle" });
    } else {
      await migratePostgres(handle.db, { migrationsFolder: "drizzle" });
    }
    console.log(`✓ migrations applied to ${handle.target}`);
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error("✗ migration failed:", err);
  process.exit(1);
});
