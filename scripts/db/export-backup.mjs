// Full JSON export of every non-empty table in the `public` schema.
//
// This is the pre-migration safety net (MIGRATION_AUDIT.md §12.1, step 2).
// It is READ-ONLY — it issues SELECTs and nothing else. Output lands in
// `backups/<timestamp>/`, which is gitignored because it contains real
// customer PII and must never reach the repository.
//
// Uses the dependency-free raw client (pg-raw.mjs) deliberately: this must
// be runnable before, during and after the migration regardless of what is
// installed in node_modules.
//
//   node scripts/db/export-backup.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./pg-raw.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;
  // Falls back to the Medusa backend's .env — the only place the connection
  // string lives today. Never printed, never copied anywhere else.
  const envPath = path.join(root, "apps/backend/apps/backend/.env");
  const match = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error("DATABASE_URL not found in env or " + envPath);
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const url = databaseUrl();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "backups", stamp);
fs.mkdirSync(outDir, { recursive: true });

const [{ rows: tables }] = await query(url, [
  `SELECT c.relname AS name FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`,
]);

const manifest = { exportedAt: new Date().toISOString(), schema: "public", tables: {} };
let totalRows = 0;
let exported = 0;

// One statement per table rather than a giant UNION: keeps memory bounded and
// makes a single failing table obvious instead of failing the whole export.
for (const { name } of tables) {
  const [res] = await query(url, [`SELECT * FROM public."${name}"`]);
  if (res.error) {
    console.error(`  !! ${name}: ${res.error}`);
    manifest.tables[name] = { error: res.error };
    continue;
  }
  manifest.tables[name] = { rows: res.rows.length };
  totalRows += res.rows.length;
  if (res.rows.length === 0) continue; // empty tables are recorded, not written
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(res.rows, null, 1));
  exported++;
  console.log(`  ${String(res.rows.length).padStart(7)}  ${name}`);
}

fs.writeFileSync(path.join(outDir, "_manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nExported ${exported} non-empty tables (${totalRows} rows) of ${tables.length} to:`);
console.log(`  backups/${stamp}/`);
