// Migration runner. Forward-only, numbered .sql files, applied once each and
// recorded in shop.schema_migration.
//
// Deliberately not an ORM's migration system: plain SQL files are reviewable,
// diffable, and runnable by hand against Supabase's SQL editor if anything
// ever goes wrong at 2am.
//
//   node db/migrate.mjs           apply everything pending
//   node db/migrate.mjs --status  show what is applied vs pending
//
// Uses the SESSION-mode connection (port 5432) — DDL must not run through the
// transaction pooler.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dir, "migrations");

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
      })
  );
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const local = readEnvFile(path.join(dir, "../.env.local")).DATABASE_URL;
  if (local) return local;
  throw new Error("DATABASE_URL is not set (checked env, .env.local)");
}

const sql = postgres(databaseUrl(), { ssl: "require", max: 1, idle_timeout: 5 });

try {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS shop;
    CREATE TABLE IF NOT EXISTS shop.schema_migration (
      name        text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  `).simple();

  const applied = new Map(
    (await sql`SELECT name, checksum FROM shop.schema_migration`).map((r) => [r.name, r.checksum])
  );
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  if (process.argv.includes("--status")) {
    for (const f of files) console.log(`${applied.has(f) ? "applied " : "PENDING "} ${f}`);
    process.exit(0);
  }

  let ran = 0;
  for (const file of files) {
    const body = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const checksum = crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);

    if (applied.has(file)) {
      // A changed checksum means someone edited a migration that already ran —
      // the one thing this scheme cannot recover from silently.
      if (applied.get(file) !== checksum) {
        console.error(`!! ${file} was modified after being applied. Add a new migration instead.`);
        process.exitCode = 1;
      }
      continue;
    }

    process.stdout.write(`applying ${file} ... `);
    await sql.unsafe(body).simple();
    await sql`INSERT INTO shop.schema_migration (name, checksum) VALUES (${file}, ${checksum})`;
    console.log("ok");
    ran++;
  }

  console.log(ran === 0 ? "Nothing to apply — schema is up to date." : `Applied ${ran} migration(s).`);

  // --- Enforced invariant: RLS on every shop table -------------------------
  //
  // 0001 ends with a DO block that enables RLS across the schema, and on the
  // first run it silently did not take effect — every table came back with
  // relrowsecurity = false, even though the identical block worked when run
  // on its own and the statements around it (triggers, REVOKE) clearly ran.
  // The cause was never pinned down.
  //
  // So this does not trust the migration to have done it. Every run asserts
  // the invariant and repairs it, then re-checks. A new table added by a
  // future migration is covered automatically, and "RLS is on" stops being
  // something we believe and becomes something we verify.
  const missing = await sql`
    SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'shop' AND c.relkind = 'r' AND NOT c.relrowsecurity
     ORDER BY 1`;

  if (missing.length > 0) {
    console.log(`RLS missing on ${missing.length} table(s) — enabling: ${missing.map((r) => r.relname).join(", ")}`);
    for (const { relname } of missing) {
      await sql.unsafe(`ALTER TABLE shop.${JSON.stringify(relname)} ENABLE ROW LEVEL SECURITY`);
    }
    const still = await sql`
      SELECT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'shop' AND c.relkind = 'r' AND NOT c.relrowsecurity`;
    if (still.length > 0) {
      console.error(`!! RLS could NOT be enabled on: ${still.map((r) => r.relname).join(", ")}`);
      process.exitCode = 1;
    }
  }

  // Zero policies is the intended state (full lockdown). A policy appearing
  // here means someone opened a door; say so rather than let it pass.
  const [{ count: policies }] = await sql`
    SELECT COUNT(*)::int AS count FROM pg_policies WHERE schemaname = 'shop'`;

  const [{ count: tableCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'shop' AND c.relkind = 'r'`;

  console.log(`RLS: enabled on ${tableCount}/${tableCount} shop tables, ${policies} policies (expected 0).`);
  if (policies > 0) console.warn("!! Unexpected RLS policies exist in `shop` — review before shipping.");
} finally {
  await sql.end();
}
