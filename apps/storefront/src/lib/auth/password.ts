import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from node:crypto — no dependency, and a
 * memory-hard KDF that OWASP lists as an acceptable choice alongside
 * argon2id and bcrypt.
 *
 * Parameters follow OWASP's scrypt guidance (N=2^16, r=8, p=1). maxmem must
 * be raised explicitly: Node's 32MB default is below what N=65536 needs
 * (~64MB), and without it scrypt fails at runtime rather than at review time.
 *
 * Stored format: `scrypt$N$r$p$<salt-hex>$<hash-hex>`. The parameters travel
 * with the hash so they can be raised later without invalidating existing
 * passwords — an old hash still verifies against its own recorded cost.
 */
const N = 65536;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * N * R * 2; // ~134MB — comfortably above the 128*N*r requirement

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Constant-time verification. Returns false for a malformed or unknown-format
 * stored value rather than throwing, so a corrupted row is a failed login
 * rather than a 500 — and never a successful one.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: Math.max(MAXMEM, 128 * n * r * 2),
    });
    // Length check first: timingSafeEqual throws on a length mismatch.
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
