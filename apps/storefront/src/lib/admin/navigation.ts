import "server-only";
import { sql, transaction } from "@/lib/db/client";
import type { NavDestinationType } from "@/lib/data/navigation";

/** Admin reads/writes for the main navigation (shop.nav_item, location='header'). */

export type AdminNavItem = {
  id: string;
  label: string;
  destinationType: NavDestinationType;
  destinationValue: string | null;
  textColor: string | null;
  backgroundColor: string | null;
  hoverColor: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Row = {
  id: string; label: string; destination_type: NavDestinationType;
  destination_value: string | null; text_color: string | null;
  background_color: string | null; hover_color: string | null;
  sort_order: number; is_active: boolean;
};

const toAdmin = (r: Row): AdminNavItem => ({
  id: r.id, label: r.label, destinationType: r.destination_type,
  destinationValue: r.destination_value, textColor: r.text_color,
  backgroundColor: r.background_color, hoverColor: r.hover_color,
  sortOrder: r.sort_order, isActive: r.is_active,
});

// Includes hidden items — the admin list must show drafts, unlike the
// storefront query which filters them out.
export async function listNavItems(): Promise<AdminNavItem[]> {
  const rows = await sql<Row[]>`
    SELECT id, label, destination_type, destination_value,
           text_color, background_color, hover_color, sort_order, is_active
      FROM shop.nav_item
     WHERE location = 'header'
     ORDER BY sort_order, created_at`;
  return rows.map(toAdmin);
}

export type SaveNavItemInput = {
  id?: string;
  label: string;
  destinationType: NavDestinationType;
  destinationValue: string | null;
  textColor: string | null;
  backgroundColor: string | null;
  hoverColor: string | null;
  sortOrder: number;
  isActive: boolean;
};

export async function saveNavItem(input: SaveNavItemInput): Promise<string> {
  if (input.id) {
    await sql`
      UPDATE shop.nav_item SET
        label = ${input.label}, destination_type = ${input.destinationType},
        destination_value = ${input.destinationValue},
        text_color = ${input.textColor}, background_color = ${input.backgroundColor},
        hover_color = ${input.hoverColor}, sort_order = ${input.sortOrder},
        is_active = ${input.isActive}, updated_at = now()
      WHERE id = ${input.id}`;
    return input.id;
  }
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO shop.nav_item
      (location, label, destination_type, destination_value,
       text_color, background_color, hover_color, sort_order, is_active)
    VALUES ('header', ${input.label}, ${input.destinationType}, ${input.destinationValue},
            ${input.textColor}, ${input.backgroundColor}, ${input.hoverColor},
            ${input.sortOrder}, ${input.isActive})
    RETURNING id`;
  return row.id;
}

export async function deleteNavItem(id: string): Promise<void> {
  await sql`DELETE FROM shop.nav_item WHERE id = ${id}`;
}

export async function setNavItemActive(id: string, isActive: boolean): Promise<void> {
  await sql`UPDATE shop.nav_item SET is_active = ${isActive}, updated_at = now() WHERE id = ${id}`;
}

/**
 * Swaps an item with its neighbour, in a transaction — same approach as the
 * homepage sections.
 *
 * `id <> ${id}` is load-bearing: a JS Date carries millisecond precision
 * while timestamptz stores microseconds, so a round-tripped created_at is
 * fractionally earlier than the stored value and a row satisfies its own `>`
 * comparison. Without this, every item finds ITSELF as its neighbour and
 * reordering silently does nothing (a real bug, caught live on the homepage
 * builder — see cms.ts).
 */
export async function moveNavItem(id: string, direction: "up" | "down"): Promise<void> {
  await transaction(async (tx) => {
    const [current] = await tx<{ sort_order: number; created_at: Date }[]>`
      SELECT sort_order, created_at FROM shop.nav_item WHERE id = ${id}`;
    if (!current) return;

    const [neighbour] = direction === "up"
      ? await tx<{ id: string; sort_order: number }[]>`
          SELECT id, sort_order FROM shop.nav_item
           WHERE id <> ${id} AND location = 'header'
             AND (sort_order, created_at) < (${current.sort_order}, ${current.created_at})
           ORDER BY sort_order DESC, created_at DESC LIMIT 1`
      : await tx<{ id: string; sort_order: number }[]>`
          SELECT id, sort_order FROM shop.nav_item
           WHERE id <> ${id} AND location = 'header'
             AND (sort_order, created_at) > (${current.sort_order}, ${current.created_at})
           ORDER BY sort_order, created_at LIMIT 1`;
    if (!neighbour) return; // already at the end — a no-op, not an error

    const a = neighbour.sort_order;
    const b = current.sort_order === a ? (direction === "up" ? a - 1 : a + 1) : current.sort_order;
    await tx`UPDATE shop.nav_item SET sort_order = ${a} WHERE id = ${id}`;
    await tx`UPDATE shop.nav_item SET sort_order = ${b} WHERE id = ${neighbour.id}`;
  });
}
