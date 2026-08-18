"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, auditLog } from "@/lib/admin/auth";
import {
  deleteNavItem,
  moveNavItem,
  saveNavItem,
  setNavItemActive,
} from "@/lib/admin/navigation";
import { NAV_CACHE_TAG, type NavDestinationType } from "@/lib/data/navigation";
import type { ActionResult } from "@/lib/admin/catalog-actions";

/**
 * Navigation writes.
 *
 * Every action calls requireAdmin() FIRST, before reading its arguments — a
 * Server Action is a public HTTP endpoint that middleware never sees.
 */

const EXPIRED: ActionResult = { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };

const DESTINATION_TYPES: NavDestinationType[] = [
  "category",
  "collection",
  "product",
  "new_arrivals",
  "sale",
  "custom",
];

/** Fixed-route kinds carry no value; the rest require one. */
const VALUELESS: NavDestinationType[] = ["new_arrivals", "sale"];

const text = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
};

/**
 * Colours are only ever accepted as #rrggbb.
 *
 * These values are emitted into inline `color`/`backgroundColor`, so anything
 * looser — `red; position:fixed`, a url(), a CSS variable — would let an
 * admin break the header layout or smuggle in styling. The database CHECK
 * enforces the same shape; this is the friendly half of the same rule.
 */
const HEX = /^#[0-9a-fA-F]{6}$/;
const colour = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return HEX.test(s) ? s.toLowerCase() : null;
};

/**
 * A destination must be a path on this site or an absolute http(s) URL.
 * Rejects `javascript:` and other schemes outright rather than relying on
 * React's escaping.
 */
function safeCustomHref(raw: string): string | null {
  const s = raw.trim();
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function revalidateNav() {
  updateTag(NAV_CACHE_TAG);
  revalidatePath("/admin/content/navigation");
  revalidatePath("/", "layout");
}

async function guard(): Promise<{ id: string } | null> {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function saveNavItemAction(formData: FormData): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;

  const label = text(formData.get("label"));
  if (!label) return { ok: false, error: "Η ετικέτα είναι υποχρεωτική." };

  const rawType = String(formData.get("destinationType") ?? "custom") as NavDestinationType;
  const destinationType = DESTINATION_TYPES.includes(rawType) ? rawType : "custom";

  let destinationValue: string | null = null;
  if (!VALUELESS.includes(destinationType)) {
    const raw = text(formData.get("destinationValue"));
    if (!raw) return { ok: false, error: "Διάλεξε ή συμπλήρωσε προορισμό." };
    destinationValue = destinationType === "custom" ? safeCustomHref(raw) : raw;
    if (!destinationValue) {
      return {
        ok: false,
        error: "Ο προορισμός πρέπει να ξεκινά με / ή με https://",
      };
    }
  }

  const id = text(formData.get("id")) ?? undefined;

  try {
    const savedId = await saveNavItem({
      id,
      label,
      destinationType,
      destinationValue,
      textColor: colour(formData.get("textColor")),
      backgroundColor: colour(formData.get("backgroundColor")),
      hoverColor: colour(formData.get("hoverColor")),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
      isActive: formData.get("isActive") === "on",
    });
    await auditLog(admin.id, id ? "nav_item.update" : "nav_item.create", "nav_item", savedId);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  revalidateNav();
  return { ok: true, message: id ? "Το στοιχείο ενημερώθηκε." : "Το στοιχείο δημιουργήθηκε." };
}

export async function deleteNavItemAction(id: string): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await deleteNavItem(id);
    await auditLog(admin.id, "nav_item.delete", "nav_item", id);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
  revalidateNav();
  return { ok: true, message: "Το στοιχείο διαγράφηκε." };
}

export async function setNavItemActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await setNavItemActive(id, isActive);
    await auditLog(admin.id, `nav_item.${isActive ? "show" : "hide"}`, "nav_item", id);
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
  revalidateNav();
  return { ok: true, message: isActive ? "Το στοιχείο εμφανίζεται." : "Το στοιχείο κρύφτηκε." };
}

export async function moveNavItemAction(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const admin = await guard();
  if (!admin) return EXPIRED;
  try {
    await moveNavItem(id, direction);
    await auditLog(admin.id, "nav_item.move", "nav_item", id, { direction });
  } catch {
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }
  revalidateNav();
  return { ok: true };
}
