-- Supabase security-linter fix: rls_disabled_in_public / sensitive_columns_exposed.
--
-- Context: this database has no supabase-js/PostgREST consumer anywhere in the
-- codebase (storefront and admin only ever talk to Medusa's own Store/Admin API).
-- Medusa's own connection role is `postgres`, which has BYPASSRLS, so enabling
-- RLS here has zero effect on Medusa itself — it only closes the gap where
-- Supabase's auto-generated Data API (PostgREST, reachable with the project's
-- `anon` key) could otherwise read/write every table directly, including
-- customer, order, user, api_key, auth_password_reset_token, etc.
--
-- Fix: enable RLS on every public table with zero policies. Postgres RLS with
-- no policies denies all rows to any role without BYPASSRLS — a complete,
-- correct lockdown for tables that have no intended direct-API consumer.
-- Covers all tables dynamically so it also protects any table a future
-- Medusa/custom-module migration adds.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
