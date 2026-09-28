import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { DB, DbHandle } from "./client";
import * as schema from "./schema";

/**
 * Embedded Postgres for local development: zero setup, stored on disk.
 * Only one process can open the directory at a time.
 */
export function createPgliteClient(dir = process.env.PGLITE_DIR ?? ".data/pglite"): DbHandle & { pglite: PGlite } {
  const pglite = new PGlite(dir);
  return { db: drizzle(pglite, { schema }) as unknown as DB, close: () => pglite.close(), kind: "pglite", pglite };
}
