import "server-only";
import { sql } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/**
 * Store configuration: shipping, analytics, search synonyms and the admin
 * users themselves.
 *
 * Payment deliberately has no editor. Exactly one method exists (cash on
 * delivery) and it has nothing to configure; a settings screen offering
 * toggles for methods that do not exist would be furniture.
 */

export class SettingsError extends Error {
  constructor(
    message: string,
    public readonly code: "duplicate_email" | "not_found" | "wrong_password" | "last_owner"
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Shipping methods
// ---------------------------------------------------------------------------

export type AdminShippingMethod = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  freeOverCents: number | null;
  isPickup: boolean;
  isActive: boolean;
  sortOrder: number;
};

export async function listShippingMethods(): Promise<AdminShippingMethod[]> {
  const rows = await sql<
    {
      id: string; name: string; description: string | null; price_cents: number;
      free_over_cents: number | null; is_pickup: boolean; is_active: boolean; sort_order: number;
    }[]
  >`SELECT id, name, description, price_cents, free_over_cents, is_pickup, is_active, sort_order
      FROM shop.shipping_method ORDER BY sort_order, name`;

  return rows.map((r) => ({
    id: r.id, name: r.name, description: r.description, priceCents: r.price_cents,
    freeOverCents: r.free_over_cents, isPickup: r.is_pickup, isActive: r.is_active,
    sortOrder: r.sort_order,
  }));
}

export async function saveShippingMethod(input: {
  id?: string;
  name: string;
  description: string | null;
  priceCents: number;
  freeOverCents: number | null;
  isPickup: boolean;
  isActive: boolean;
  sortOrder: number;
}): Promise<void> {
  if (input.id) {
    await sql`
      UPDATE shop.shipping_method SET
        name = ${input.name}, description = ${input.description},
        price_cents = ${input.priceCents}, free_over_cents = ${input.freeOverCents},
        is_pickup = ${input.isPickup}, is_active = ${input.isActive}, sort_order = ${input.sortOrder}
      WHERE id = ${input.id}`;
    return;
  }
  await sql`
    INSERT INTO shop.shipping_method (name, description, price_cents, free_over_cents,
                                      is_pickup, is_active, sort_order)
    VALUES (${input.name}, ${input.description}, ${input.priceCents}, ${input.freeOverCents},
            ${input.isPickup}, ${input.isActive}, ${input.sortOrder})`;
}

/**
 * Deactivates rather than deletes when the method has been used. Orders store
 * the method NAME, so history survives either way — but a cart currently
 * pointing at it would lose its selection mid-checkout, and an inactive row
 * simply stops being offered.
 */
export async function deleteShippingMethod(id: string): Promise<"deleted" | "disabled"> {
  const [{ inUse }] = await sql<{ inUse: number }[]>`
    SELECT COUNT(*)::int AS "inUse" FROM shop.cart WHERE shipping_method_id = ${id}`;
  if (inUse > 0) {
    await sql`UPDATE shop.shipping_method SET is_active = false WHERE id = ${id}`;
    return "disabled";
  }
  await sql`DELETE FROM shop.shipping_method WHERE id = ${id}`;
  return "deleted";
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type AdminAnalyticsSettings = {
  ga4MeasurementId: string | null;
  gtmContainerId: string | null;
  metaPixelId: string | null;
  clarityProjectId: string | null;
};

export async function getAdminAnalytics(): Promise<AdminAnalyticsSettings> {
  const rows = await sql<
    {
      ga4_measurement_id: string | null; gtm_container_id: string | null;
      meta_pixel_id: string | null; clarity_project_id: string | null;
    }[]
  >`SELECT ga4_measurement_id, gtm_container_id, meta_pixel_id, clarity_project_id
      FROM shop.analytics_setting LIMIT 1`;
  const a = rows[0];
  return {
    ga4MeasurementId: a?.ga4_measurement_id || null,
    gtmContainerId: a?.gtm_container_id || null,
    metaPixelId: a?.meta_pixel_id || null,
    clarityProjectId: a?.clarity_project_id || null,
  };
}

export async function saveAnalytics(input: AdminAnalyticsSettings): Promise<void> {
  await sql`
    INSERT INTO shop.analytics_setting (id, ga4_measurement_id, gtm_container_id,
                                        meta_pixel_id, clarity_project_id, updated_at)
    VALUES (true, ${input.ga4MeasurementId}, ${input.gtmContainerId},
            ${input.metaPixelId}, ${input.clarityProjectId}, now())
    ON CONFLICT (id) DO UPDATE SET
      ga4_measurement_id = EXCLUDED.ga4_measurement_id,
      gtm_container_id = EXCLUDED.gtm_container_id,
      meta_pixel_id = EXCLUDED.meta_pixel_id,
      clarity_project_id = EXCLUDED.clarity_project_id,
      updated_at = now()`;
}

// ---------------------------------------------------------------------------
// Search synonyms
// ---------------------------------------------------------------------------

export type AdminSynonym = { id: string; terms: string };

export async function listSynonyms(): Promise<AdminSynonym[]> {
  return sql<AdminSynonym[]>`SELECT id, terms FROM shop.search_synonym ORDER BY terms`;
}

export async function saveSynonym(id: string | undefined, terms: string): Promise<void> {
  if (id) {
    await sql`UPDATE shop.search_synonym SET terms = ${terms} WHERE id = ${id}`;
    return;
  }
  await sql`INSERT INTO shop.search_synonym (terms) VALUES (${terms})`;
}

export async function deleteSynonym(id: string): Promise<void> {
  await sql`DELETE FROM shop.search_synonym WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Admin users
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "staff";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await sql<
    {
      id: string; email: string; name: string; role: "owner" | "staff";
      is_active: boolean; last_login_at: Date | null; created_at: Date;
    }[]
  >`SELECT id, email, name, role, is_active, last_login_at, created_at
      FROM shop.admin_user ORDER BY role, name`;

  return rows.map((r) => ({
    id: r.id, email: r.email, name: r.name, role: r.role, isActive: r.is_active,
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function createAdmin(input: {
  email: string;
  password: string;
  name: string;
  role: "owner" | "staff";
}): Promise<void> {
  const dupe = await sql<{ id: string }[]>`
    SELECT id FROM shop.admin_user WHERE lower(email) = lower(${input.email})`;
  if (dupe.length > 0) throw new SettingsError("Email already in use", "duplicate_email");

  await sql`
    INSERT INTO shop.admin_user (email, password_hash, name, role)
    VALUES (${input.email}, ${await hashPassword(input.password)}, ${input.name}, ${input.role})`;
}

/**
 * Deactivating an admin also ends their sessions. The last active owner
 * cannot be deactivated or demoted — otherwise the store can be locked out of
 * its own admin, recoverable only from a shell.
 */
export async function setAdminActive(id: string, isActive: boolean): Promise<void> {
  if (!isActive) await assertNotLastOwner(id);
  await sql`UPDATE shop.admin_user SET is_active = ${isActive} WHERE id = ${id}`;
  if (!isActive) await sql`DELETE FROM shop.admin_session WHERE admin_user_id = ${id}`;
}

export async function setAdminRole(id: string, role: "owner" | "staff"): Promise<void> {
  if (role === "staff") await assertNotLastOwner(id);
  await sql`UPDATE shop.admin_user SET role = ${role} WHERE id = ${id}`;
}

async function assertNotLastOwner(id: string): Promise<void> {
  const [{ owners }] = await sql<{ owners: number }[]>`
    SELECT COUNT(*)::int AS owners FROM shop.admin_user
     WHERE role = 'owner' AND is_active AND id <> ${id}`;
  if (owners === 0) throw new SettingsError("Cannot remove the last owner", "last_owner");
}

/**
 * Changing your own password. The current one is re-verified server-side, and
 * every OTHER session is destroyed — a password change should end whatever
 * access prompted it, while leaving the tab you are working in signed in.
 */
export async function changeOwnPassword(
  adminId: string,
  currentPassword: string,
  newPassword: string,
  currentTokenHash: string
): Promise<void> {
  const [u] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM shop.admin_user WHERE id = ${adminId}`;
  if (!u) throw new SettingsError("Admin not found", "not_found");
  if (!(await verifyPassword(currentPassword, u.password_hash))) {
    throw new SettingsError("Current password is incorrect", "wrong_password");
  }

  await sql`
    UPDATE shop.admin_user SET password_hash = ${await hashPassword(newPassword)}
     WHERE id = ${adminId}`;
  await sql`
    DELETE FROM shop.admin_session
     WHERE admin_user_id = ${adminId} AND token_hash <> ${currentTokenHash}`;
}

export async function updateOwnProfile(adminId: string, name: string): Promise<void> {
  await sql`UPDATE shop.admin_user SET name = ${name} WHERE id = ${adminId}`;
}
