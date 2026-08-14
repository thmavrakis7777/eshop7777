import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db/client";

/**
 * Opaque server-side sessions, deliberately not JWTs.
 *
 * A JWT cannot be revoked before it expires, needs a refresh dance to stay
 * short-lived, and turns secret rotation into a logout event for everyone.
 * A random token looked up in a table is revocable instantly (logout, password
 * change, admin action), has no signing secret to rotate, and costs one
 * indexed primary-key read per request.
 *
 * Only the SHA-256 of the token is stored. A database leak therefore does not
 * hand over live sessions — the same reasoning as storing password hashes.
 * SHA-256 (not scrypt) is correct here: the token is 256 bits of CSPRNG
 * output, so there is no low-entropy secret to slow an attacker down over.
 */

const SESSION_BYTES = 32;

export const CUSTOMER_SESSION_COOKIE = "stia_session";
export const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const cookieOptions = {
  maxAge: CUSTOMER_SESSION_MAX_AGE,
  sameSite: "lax" as const,
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createCustomerSession(customerId: string): Promise<string> {
  const token = randomBytes(SESSION_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_MAX_AGE * 1000);
  await sql`
    INSERT INTO shop.customer_session (token_hash, customer_id, expires_at)
    VALUES (${hashToken(token)}, ${customerId}, ${expiresAt})`;
  return token;
}

/** Returns the customer id, or null for an unknown/expired session. */
export async function resolveCustomerSession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const rows = await sql<{ customer_id: string }[]>`
    SELECT s.customer_id
      FROM shop.customer_session s
      JOIN shop.customer c ON c.id = s.customer_id
     WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now() AND c.is_active
     LIMIT 1`;
  return rows[0]?.customer_id ?? null;
}

export async function destroyCustomerSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await sql`DELETE FROM shop.customer_session WHERE token_hash = ${hashToken(token)}`;
}

/**
 * Invalidates every session for a customer. Called on password change, so
 * changing a password actually ends any session an attacker may hold —
 * the thing customers assume happens and JWTs cannot deliver.
 */
export async function destroyAllCustomerSessions(customerId: string): Promise<void> {
  await sql`DELETE FROM shop.customer_session WHERE customer_id = ${customerId}`;
}

// ---------------------------------------------------------------------------
// Password reset tokens
// ---------------------------------------------------------------------------

const RESET_TOKEN_TTL_MINUTES = 30;

export async function createPasswordResetToken(customerId: string): Promise<string> {
  const token = randomBytes(SESSION_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  await sql`
    INSERT INTO shop.password_reset_token (token_hash, customer_id, expires_at)
    VALUES (${hashToken(token)}, ${customerId}, ${expiresAt})`;
  return token;
}

/**
 * Consumes a reset token atomically. The `used_at IS NULL` predicate is part
 * of the UPDATE, so two concurrent requests with the same token cannot both
 * succeed — single-use is enforced by the database, not by a read-then-write
 * in application code.
 */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const rows = await sql<{ customer_id: string }[]>`
    UPDATE shop.password_reset_token
       SET used_at = now()
     WHERE token_hash = ${hashToken(token)} AND used_at IS NULL AND expires_at > now()
    RETURNING customer_id`;
  return rows[0]?.customer_id ?? null;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/**
 * Fixed-window rate limit, stored in Postgres rather than memory because
 * serverless instances do not share memory — an in-process counter would
 * reset on every cold start and be trivially bypassed.
 *
 * Returns true when the action is allowed. Fails OPEN on a database error:
 * an outage should not lock every customer out of logging in. That is a
 * deliberate availability-over-strictness trade for a login throttle, not
 * an oversight — it is not the only control (passwords are still hashed and
 * verified, and enumeration is already prevented).
 *
 * Closes the gap PROJECT_MEMORY.md flagged: Medusa's endpoints had no
 * rate limiting at all.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const rows = await sql<{ count: number }[]>`
      INSERT INTO shop.rate_limit (key, count, window_start)
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN shop.rate_limit.window_start < now() - ${`${windowSeconds} seconds`}::interval THEN 1
          ELSE shop.rate_limit.count + 1
        END,
        window_start = CASE
          WHEN shop.rate_limit.window_start < now() - ${`${windowSeconds} seconds`}::interval THEN now()
          ELSE shop.rate_limit.window_start
        END
      RETURNING count`;
    return (rows[0]?.count ?? 1) <= limit;
  } catch {
    return true;
  }
}

/** Best-effort cleanup of expired rows. Safe to call opportunistically. */
export async function pruneExpiredAuthRows(): Promise<void> {
  try {
    await sql`DELETE FROM shop.customer_session WHERE expires_at < now()`;
    await sql`DELETE FROM shop.password_reset_token WHERE expires_at < now()`;
    await sql`DELETE FROM shop.rate_limit WHERE window_start < now() - interval '1 day'`;
  } catch {
    // Housekeeping only — never surface.
  }
}
