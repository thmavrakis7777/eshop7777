import "server-only";
import postgres from "postgres";

/**
 * The single Postgres connection for the whole application.
 *
 * Deliberately NOT `supabase-js`: every query in this app runs server-side
 * (Server Components and Server Actions), so a browser-facing client would
 * buy nothing and would force opening Supabase's Data API plus authoring a
 * full RLS policy set — strictly weakening the current zero-policy lockdown.
 * See MIGRATION_AUDIT.md §8.2.
 *
 * `server-only` above is the hard guarantee: importing this from a Client
 * Component is a build error, not a runtime surprise, so the connection
 * string can never be bundled into browser JavaScript.
 */

declare global {
  var __shopSql: ReturnType<typeof postgres> | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy it from Supabase (Project Settings → Database → " +
        "Connection string) into apps/storefront/.env.local. It is server-only — never " +
        "prefix it with NEXT_PUBLIC_."
    );
  }
  return url;
}

// `next build` renders every route once per build worker (11 on this
// machine) to classify it as static/dynamic, each importing this module
// fresh — i.e. its own pool. Kept deliberately small during the build phase
// even now that DATABASE_URL is on the transaction-mode pooler (see below):
// build-time concurrency has no reason to be as high as request-time.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function createClient() {
  return postgres(connectionString(), {
    ssl: "require",
    // Serverless functions each hold their own pool, so this is per-instance,
    // not global (MIGRATION_AUDIT.md §6.6).
    max: isBuildPhase ? 1 : process.env.NODE_ENV === "production" ? 5 : 2,
    idle_timeout: 20,
    connect_timeout: 10,
    // Both required for Supabase's transaction-mode pooler (port 6543 —
    // the correct mode for many short-lived connections, and what
    // DATABASE_URL is on): a pooled transaction can land on a different
    // physical backend connection each time.
    // - prepare: false — a prepared statement is tied to one specific
    //   connection, which transaction-mode pooling doesn't guarantee.
    // - fetch_types: false — postgres.js defaults to fetch_types: true,
    //   which runs a pg_catalog introspection query on every new
    //   connection to build its type parser. This is the fix that took
    //   two attempts to find (2026-08-17, MIGRATION_PLAN.md Phase 16): the
    //   first attempt at transaction mode had prepare:false but not this,
    //   and broke every query with Postgres error 57014 "canceling
    //   statement due to statement timeout" — the introspection query and
    //   the app's actual query landing on different physical connections
    //   under Supavisor's transaction-mode pooling is a documented
    //   postgres.js/pgbouncer-family failure mode. Verified via an
    //   isolated script (concurrent queries, a real transaction, and a
    //   post-idle-gap query) before touching this file.
    prepare: false,
    fetch_types: false,
    // Postgres returns NUMERIC as a string to preserve precision. Money is
    // always integer cents here, so the only numerics are VAT rates, where a
    // JS number is exact and far easier to work with.
    types: {
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
    // Transform undefined to NULL instead of throwing — an optional field
    // that simply wasn't provided is the normal case in this codebase.
    transform: { undefined: null },
  });
}

// Next.js dev server hot-reloads modules, which would otherwise open a fresh
// pool on every edit until the database refuses new connections. Caching on
// globalThis is the standard escape hatch; production gets one per instance.
export const sql = globalThis.__shopSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__shopSql = sql;

/**
 * Runs `fn` inside a single transaction. Everything in the callback must use
 * the `tx` handle — using the outer `sql` would silently run outside the
 * transaction and defeat the point.
 *
 * Used by anything that must be all-or-nothing: order completion above all
 * (MIGRATION_AUDIT.md §8.6).
 */
export type Tx = postgres.TransactionSql<Record<string, never>>;

export function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql.begin(fn as (tx: Tx) => Promise<T>) as Promise<T>;
}

/** Money helpers — cents are the only representation that crosses the DB boundary. */
export const toCents = (euros: number): number => Math.round(euros * 100);
export const fromCents = (cents: number): number => cents / 100;
