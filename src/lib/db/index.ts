import "server-only";
import { createPostgresClient, type DB } from "./client";

// Local dev falls back to embedded PGlite. NODE_ENV is inlined at build time, so
// in production this block — and the 25 MB PGlite package — is compiled away.
let devDriver: typeof import("./pglite") | null = null;
if (process.env.NODE_ENV !== "production") {
  devDriver = await import("./pglite");
}

function createAppDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) return createPostgresClient(url).db;
  if (devDriver) return devDriver.createPgliteClient().db;
  throw new Error("DATABASE_URL is not set. Point it at your Postgres (e.g. the Supabase transaction pooler) — see README.");
}

// One connection (pool) per server process. Cached on globalThis so dev-mode hot
// reloads don't open a second PGlite instance on the same data directory.
const globalForDb = globalThis as unknown as { __reckonDb?: DB };

function getDb(): DB {
  return (globalForDb.__reckonDb ??= createAppDb());
}

// Lazily connect on first use rather than at import time, so `next build` can
// import server modules without opening the database.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * from "./schema";
