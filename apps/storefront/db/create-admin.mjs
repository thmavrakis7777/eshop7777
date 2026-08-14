// Creates (or updates) an admin user.
//
// Bootstrapping problem: the admin UI requires an admin to sign in, so the
// first one cannot be created through it. This is that door — deliberately a
// local CLI rather than a public "first run" web page, which would be an
// open account-creation endpoint if it ever shipped misconfigured.
//
//   node db/create-admin.mjs <email> <password> "<name>" [owner|staff]
//
// The password is read from argv for a one-off local bootstrap. Change it
// from the admin UI afterwards if the shell history matters to you.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const scryptAsync = promisify(crypto.scrypt);

// Mirrors lib/auth/password.ts exactly — same algorithm, same parameters,
// same stored format. If one changes, both must.
const N = 65536, R = 8, P = 1, KEYLEN = 64, MAXMEM = 128 * N * R * 2;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const [email, password, name, role = "owner"] = process.argv.slice(2);

if (!email || !password || !name) {
  console.error('Usage: node db/create-admin.mjs <email> <password> "<name>" [owner|staff]');
  process.exit(1);
}
if (!["owner", "staff"].includes(role)) {
  console.error(`Role must be "owner" or "staff" — got "${role}"`);
  process.exit(1);
}
if (password.length < 12) {
  // Stricter than the storefront's 8: this account can edit every price and
  // read every order.
  console.error("Admin passwords must be at least 12 characters.");
  process.exit(1);
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(dir, "../.env.local"), "utf8");
const url = process.env.DATABASE_URL || env.match(/^DATABASE_URL=(.*)$/m)[1].trim();

const sql = postgres(url, { ssl: "require", max: 1 });
try {
  const hash = await hashPassword(password);
  const [row] = await sql`
    INSERT INTO shop.admin_user (email, password_hash, name, role)
    VALUES (${email}, ${hash}, ${name}, ${role})
    ON CONFLICT (lower(email)) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      is_active = true
    RETURNING id, email, name, role`;
  console.log("Admin ready:", row);
  console.log("\nSign in at /admin/login");
} finally {
  await sql.end();
}
