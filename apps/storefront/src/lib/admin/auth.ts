import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/**
 * Admin authentication — deliberately a SEPARATE system from customer auth:
 * different table, different cookie name, different path scope, different
 * lifetime. A customer session must never be able to become an admin session,
 * and the cleanest way to guarantee that is to share no code path that could
 * ever confuse the two.
 *
 * Authorization is checked in TWO places, on purpose:
 *   1. src/proxy.ts, which keeps unauthenticated requests off /admin entirely.
 *   2. requireAdmin() inside every admin Server Action and page.
 * The edge check is a convenience for redirecting; it is never the only
 * control, because a Server Action can be invoked directly with a crafted
 * request that never passes through a page render.
 */

export const ADMIN_SESSION_COOKIE = "stia_admin";
// Deliberately shorter than the customer's 30 days: an admin session grants
// write access to the whole catalogue and every order.
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export const adminCookieOptions = {
  maxAge: ADMIN_SESSION_MAX_AGE,
  sameSite: "lax" as const,
  // Scoped to /admin so the cookie is not attached to ordinary storefront
  // requests at all — it simply is not present on the surface most exposed
  // to untrusted input.
  path: "/admin",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

export type AdminRole = "owner" | "staff";
export type AdminUser = { id: string; email: string; name: string; role: AdminRole };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export class AdminAuthError extends Error {}

export async function loginAdmin(email: string, password: string): Promise<string> {
  const [u] = await sql<{ id: string; password_hash: string }[]>`
    SELECT id, password_hash FROM shop.admin_user
     WHERE lower(email) = lower(${email}) AND is_active`;

  // Same constant-ish work on both paths, same message — an admin login form
  // is a prime enumeration target.
  if (!u) {
    await verifyPassword(password, "scrypt$65536$8$1$" + "0".repeat(32) + "$" + "0".repeat(128));
    throw new AdminAuthError("Invalid credentials");
  }
  if (!(await verifyPassword(password, u.password_hash))) throw new AdminAuthError("Invalid credentials");

  const token = randomBytes(32).toString("base64url");
  await sql`
    INSERT INTO shop.admin_session (token_hash, admin_user_id, expires_at)
    VALUES (${hashToken(token)}, ${u.id}, ${new Date(Date.now() + ADMIN_SESSION_MAX_AGE * 1000)})`;
  await sql`UPDATE shop.admin_user SET last_login_at = now() WHERE id = ${u.id}`;
  return token;
}

export async function resolveAdminSession(token: string | undefined | null): Promise<AdminUser | null> {
  if (!token) return null;
  const rows = await sql<AdminUser[]>`
    SELECT u.id, u.email, u.name, u.role
      FROM shop.admin_session s
      JOIN shop.admin_user u ON u.id = s.admin_user_id
     WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now() AND u.is_active
     LIMIT 1`;
  return rows[0] ?? null;
}

/** The signed-in admin, or null. Never throws — used for redirect decisions. */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    return await resolveAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

/**
 * Throws unless a valid admin session exists. Every admin Server Action calls
 * this FIRST, before reading its arguments — an action is a public HTTP
 * endpoint, and the middleware never runs for it.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) throw new AdminAuthError("Not authenticated");
  return admin;
}

/** Owner-only operations (destructive settings, managing other admins). */
export async function requireOwner(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.role !== "owner") throw new AdminAuthError("Insufficient permissions");
  return admin;
}

export async function logoutAdmin(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) await sql`DELETE FROM shop.admin_session WHERE token_hash = ${hashToken(token)}`;
  jar.delete({ name: ADMIN_SESSION_COOKIE, path: adminCookieOptions.path });
}

export async function setAdminSessionCookie(token: string): Promise<void> {
  (await cookies()).set(ADMIN_SESSION_COOKIE, token, adminCookieOptions);
}

/**
 * Records who changed what. Called by mutating admin actions. Deliberately
 * never throws: an audit-log failure must not roll back the operation the
 * admin actually asked for — a missing log line is recoverable, a half-applied
 * catalogue edit is not.
 */
export async function auditLog(
  adminUserId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  diff?: Record<string, unknown>
): Promise<void> {
  try {
    await sql`
      INSERT INTO shop.admin_audit_log (admin_user_id, action, entity_type, entity_id, diff)
      VALUES (${adminUserId}, ${action}, ${entityType ?? null}, ${entityId ?? null},
              ${diff ? sql.json(diff as never) : null})`;
  } catch {
    // Intentionally swallowed — see above.
  }
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.admin_user (email, password_hash, name, role)
    VALUES (${input.email}, ${await hashPassword(input.password)}, ${input.name}, ${input.role})
    RETURNING id`;
  return row.id;
}
