import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Separate from vitest.config.ts on purpose: this targets db/concurrency-test.ts,
// a real-database integration test that must never be picked up by the
// default `pnpm test`/CI run (see that file's own header comment for why).
// Invoked explicitly via `pnpm db:test-concurrency`.

// Vitest doesn't read Next's env files itself. Same technique the old
// db/concurrency-test.mjs used, relocated here so it runs (and DATABASE_URL
// is set) before the test file's own `import ... from "../src/lib/db/checkout"`
// evaluates lib/db/client.ts's module-scope connection setup.
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, ".env.local");
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // `server-only` (imported by lib/db/checkout.ts et al.) resolves via its
    // package.json `exports` map: the "react-server" condition picks a
    // no-op, anything else picks a build that unconditionally throws. Only
    // Next's own bundler sets that condition normally — this tells Vite's
    // resolver to do the same, matching where this code genuinely runs in
    // production (Server Actions), rather than patching or removing the
    // guard itself.
    conditions: ["react-server"],
  },
  // Vitest loads test files through Vite's SSR pipeline, which resolves
  // package `exports` conditions separately from the client `resolve`
  // block above — both need the same condition set for `server-only` to
  // resolve to its no-op export instead of throwing.
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
  test: {
    environment: "node",
    include: ["db/concurrency-test.ts"],
    // A real Postgres transaction test genuinely takes longer than a unit
    // test's default 5s budget.
    testTimeout: 30_000,
  },
});
