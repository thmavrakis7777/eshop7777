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
    // Safe on the session-mode pooler this connects to, and required if it
    // ever moves to transaction mode: a prepared statement is tied to one
    // specific physical connection, which transaction-mode pooling doesn't
    // guarantee. (Transaction mode was benchmarked and rejected — it
    // deadlocked on 2 of 3 identical runs; see DEPLOYMENT.md.)
    prepare: false,
    // DELIBERATELY NOT `fetch_types: false`. It was set here briefly during
    // the 2026-08-17 transaction-pooler investigation on the assumption it
    // was harmless on session mode — it is not. Skipping pg_catalog type
    // introspection leaves postgres.js unable to infer an array parameter's
    // type, so it serialises a JS array as a comma-joined STRING and
    // Postgres rejects it with 22P02 "malformed array literal". That
    // silently broke every `= ANY(${array})` query — manual homepage rails,
    // cart cross-sell, recently-viewed, and the admin bulk actions — while
    // leaving scalar queries working, so nothing looked wrong until a
    // manual product rail rendered empty. If transaction mode is retried,
    // the array call sites need an explicit cast, not this flag.
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
