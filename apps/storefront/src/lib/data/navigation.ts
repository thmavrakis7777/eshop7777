import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db/client";

/**
 * The storefront's main navigation.
 *
 * Owner-composed (shop.nav_item) with a permanent fallback: when no items are
 * configured the header keeps its original behaviour of listing every
 * top-level category. A shop that has never opened this screen must still
 * have a working menu.
 */

export const NAV_CACHE_TAG = "navigation";

export type NavDestinationType =
  | "category"
  | "collection"
  | "product"
  | "new_arrivals"
  | "sale"
  | "custom";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  /** Kept so the header knows which items can open a category mega menu. */
  destinationType: NavDestinationType;
  /** Category slug for `category` items — the mega menu looks its children up by this. */
  categorySlug: string | null;
  textColor: string | null;
  backgroundColor: string | null;
  hoverColor: string | null;
};

/**
 * The one place a destination becomes a URL.
 *
 * Fixed routes are resolved here rather than stored, so renaming /prosfores
 * is a change to this function instead of an UPDATE across every row.
 */
export function resolveNavHref(type: NavDestinationType, value: string | null): string {
  switch (type) {
    case "category":
      return `/${value}`;
    case "collection":
      return `/syllogi/${value}`;
    case "product":
      return `/proionta/${value}`;
    case "new_arrivals":
      return "/nea-afiksi";
    case "sale":
      return "/prosfores";
    case "custom":
      return value ?? "/";
  }
}

type Row = {
  id: string;
  label: string;
  destination_type: NavDestinationType;
  destination_value: string | null;
  text_color: string | null;
  background_color: string | null;
  hover_color: string | null;
};

const getCachedNavItems = unstable_cache(
  async (): Promise<NavItem[]> => {
    try {
      const rows = await sql<Row[]>`
        SELECT id, label, destination_type, destination_value,
               text_color, background_color, hover_color
          FROM shop.nav_item
         WHERE is_active AND location = 'header'
         ORDER BY sort_order, created_at`;

      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        href: resolveNavHref(r.destination_type, r.destination_value),
        destinationType: r.destination_type,
        categorySlug: r.destination_type === "category" ? r.destination_value : null,
        textColor: r.text_color,
        backgroundColor: r.background_color,
        hoverColor: r.hover_color,
      }));
    } catch {
      // A nav read failing must not take the whole site down — the caller
      // falls back to the category nav, same as an empty table.
      return [];
    }
  },
  ["nav-items"],
  { revalidate: 60, tags: [NAV_CACHE_TAG] }
);

export const getNavItems = cache(getCachedNavItems);
