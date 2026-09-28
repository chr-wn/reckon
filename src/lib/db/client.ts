import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Both drivers (postgres-js here, PGlite in ./pglite for local dev) expose the
 * same query-builder API; everything is typed against the postgres-js flavour.
 */
export type DB = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: DB;
  close: () => Promise<void>;
  kind: "postgres" | "pglite";
}

export function createPostgresClient(url: string, opts: { max?: number } = {}): DbHandle {
  const client = postgres(url, {
    // Transaction-mode poolers (Supabase/Supavisor, PgBouncer) don't support prepared statements.
    prepare: false,
    max: opts.max ?? 5,
    // Serverless instances come and go; give pooler connections back quickly.
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return { db: drizzle(client, { schema }), close: () => client.end(), kind: "postgres" };
}

/** host:port/database, without credentials — for logs. */
export function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}
