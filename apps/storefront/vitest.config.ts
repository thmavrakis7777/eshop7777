import { defineConfig } from "vitest/config";
import path from "node:path";

// Fast, isolated unit tests only — no real database, no network, no
// secrets. `db/concurrency-test.ts` is deliberately NOT under src/, and
// deliberately excluded below: it's a real-database integration test (see
// its own header comment) with no test/staging database to run against
// (DEPLOYMENT.md), so it stays a separate, manually-invoked script
// (`pnpm db:test-concurrency`) rather than something `pnpm test`/CI could
// ever accidentally fire against production.
//
// computeTotals (lib/db/cart.ts) lives in a `server-only` module that also
// creates lib/db/client.ts's Postgres client at import time — this dummy
// connection string lets that module load without throwing, with zero real
// connection ever attempted (postgres.js connects lazily, per query, and
// these tests only ever call the pure computeTotals function). Real tests
// must never depend on it resolving to anything.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // See db/concurrency-test.ts / vitest.concurrency.config.ts for the full
    // explanation — `server-only`'s package.json only no-ops under this
    // condition, which is what Next's own bundler sets for Server
    // Components/Actions, the real context this code runs in.
    conditions: ["react-server"],
  },
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
