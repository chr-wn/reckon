/**
 * Shared setup for CLI scripts: load .env files exactly like Next.js does, then
 * open the database the app would use.
 *
 *   npm run db:migrate        → development env files → embedded PGlite (unless DATABASE_URL is set)
 *   npm run db:migrate:prod   → production env files (.env.production.local) → your real database
 */
import { loadEnvConfig } from "@next/env";
import { mkdirSync } from "node:fs";
import { createPostgresClient, describeUrl, type DbHandle } from "../src/lib/db/client";
import { createPgliteClient } from "../src/lib/db/pglite";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

export function openScriptDb(): DbHandle & { target: string } {
  const url = process.env.DATABASE_URL;
  if (url) return { ...createPostgresClient(url, { max: 1 }), target: describeUrl(url) };
  if (process.env.VERCEL) throw new Error("DATABASE_URL is not set for this Vercel environment.");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  mkdirSync(dir, { recursive: true });
  return { ...createPgliteClient(dir), target: `embedded PGlite (${dir})` };
}
