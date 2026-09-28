-- Supabase publishes the `public` schema through its Data API (PostgREST and
-- GraphQL) to the `anon` and `authenticated` roles, using a key that is meant to
-- be public. This app never uses that API — it talks to Postgres directly — so
-- those roles get no privileges at all. RLS (previous migration) already blocks
-- every row; revoking also hides the tables from the API's schema listing, and
-- the default-privilege change keeps future tables private too.
-- Guarded, so it's a no-op on plain Postgres and on local PGlite.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;
