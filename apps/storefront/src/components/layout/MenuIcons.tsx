import type { ReactNode } from "react";
import type { NavItem } from "@/lib/data/navigation";

/**
 * Line icons for the mobile drawer's top level, drawn for MAVRAKIS HOME
 * (owner's request, 2026-11-08). Inline SVG on currentColor: no image
 * request, no cost, and they take each row's own text colour — so the red
 * ΠΡΟΣΦΟΡΕΣ chip gets a white icon without a special case.
 *
 * Keyed by what the nav item points at, not by its label: the fixed routes
 * by destination type, categories by slug. A main category with no entry
 * here (a new one the owner adds later) simply renders without an icon.
 */
const PATHS: Record<string, ReactNode> = {
  sale: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z" />
      <path d="M9.5 14.5l5-5" />
      <circle cx="9.7" cy="9.7" r="0.9" />
      <circle cx="14.3" cy="14.3" r="0.9" />
    </>
  ),
  new_arrivals: (
    <>
      <path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z" />
      <path d="M18 15v5M15.5 17.5h5" />
    </>
  ),
  kouzina: (
    <>
      <path d="M4.5 11h15v5.5a3.5 3.5 0 0 1-3.5 3.5H8a3.5 3.5 0 0 1-3.5-3.5z" />
      <path d="M2.5 12.5h2M19.5 12.5h2" />
      <path d="M4.5 8.5c0-1.4 3.4-2.5 7.5-2.5s7.5 1.1 7.5 2.5" />
      <path d="M11 4h2" />
    </>
  ),
  "spiti-organosi": (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M4.5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M10 13h4" />
    </>
  ),
  kipos: (
    <>
      <path d="M7 14h10l-1.3 5.7a1 1 0 0 1-1 .8H9.3a1 1 0 0 1-1-.8z" />
      <path d="M12 14V8.5" />
      <path d="M12 10.5c0-3.2 2.1-5.3 6-5.3 0 3.2-2.1 5.3-6 5.3z" />
      <path d="M12 8.5c0-2.6-1.6-4.2-5-4.2 0 2.6 1.6 4.2 5 4.2z" />
    </>
  ),
  ygraerio: (
    <>
      <path d="M12 21c-3.9 0-7-2.7-7-6.5 0-3.2 2.2-5.4 3.6-7.5.4 1.6 1.3 2.8 2.4 3.3C11 7 12.5 4.5 14.5 3c.3 3 4.5 5.5 4.5 11.5 0 3.8-3.1 6.5-7 6.5z" />
      <path d="M12 21c-1.7 0-3-1.2-3-2.8 0-1.8 1.6-2.7 3-4.7 1.4 2 3 2.9 3 4.7 0 1.6-1.3 2.8-3 2.8z" />
    </>
  ),
  banio: (
    <>
      <path d="M5 21V8.5A4.5 4.5 0 0 1 9.5 4h2A2.5 2.5 0 0 1 14 6.5V7" />
      <path d="M10.5 10.5a3.5 3.5 0 0 1 7 0z" />
      <path d="M11.5 14v1M14 14v1M16.5 14v1M12.7 17.5v1M15.3 17.5v1" />
    </>
  ),
  "kleidia-asfaleia": (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2" />
    </>
  ),
  ergaleia: (
    <>
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
      <path d="M9.5 20h5" />
      <path d="M12 9.5l-1 2.5h2l-1 2.5" />
    </>
  ),
};

export function MenuItemIcon({ item }: { item: NavItem }) {
  const key = item.destinationType === "category" ? item.categorySlug : item.destinationType;
  const paths = key ? PATHS[key] : undefined;
  if (!paths) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 shrink-0"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
