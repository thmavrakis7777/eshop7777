import { parseStoreAddress } from "@/lib/address-format";

// The store's own Google Business Profile listing, as shared by the owner —
// opens the MAVRAKIS HOME place page (reviews, hours, directions) instead of
// a plain address search that could land on the wrong pin.
const STORE_MAPS_URL = "https://maps.app.goo.gl/hsopHgUrjjKZexby6";

// The pin of that same listing, read from the place page the link above
// opens (2026-10-02) — not geocoded from the address text, not estimated.
// Gives search engines the exact spot instead of leaving them to place the
// address themselves. Lives here beside the link rather than in Settings
// because it belongs to the listing: if the store ever moves, both change
// together, along with the listing.
const STORE_GEO = { latitude: 35.3378602, longitude: 25.1302297 };

// The same listing's permanent address (its CID, read from the place page the
// short link above opens, 2026-10-25). The short link is fine for people to
// click, but for `sameAs` — "this website is the same business as that
// profile" — search engines are better served by Google's own stable URL than
// by a redirect. Confirmed to open the MAVRAKIS HOME profile, Σφακιανάκη 4.
const STORE_PROFILE_URL = "https://www.google.com/maps?cid=1185734525195222833";

/**
 * Google Maps link for the store's address (Settings → contactAddress),
 * shared by the footer and the Contact page so both always point at the same
 * place. Still null when no address is set, so the link hides along with the
 * address it belongs to.
 */
export function storeMapsUrl(address: string | null | undefined): string | null {
  return address?.trim() ? STORE_MAPS_URL : null;
}

/**
 * The Google Business Profile as a `sameAs` entry for the Store JSON-LD,
 * alongside whatever social profiles are set in Settings. Empty when no
 * address is set, the same rule as storeMapsUrl and storeLocationJsonLd: no
 * address on the site, no claim about a physical listing.
 */
export function storeProfileSameAs(address: string | null | undefined): string[] {
  return address?.trim() ? [STORE_PROFILE_URL] : [];
}

/**
 * The location fields of the store's schema.org JSON-LD — the Store in the
 * storefront layout and the Locksmith on the key-copying page — so both
 * describe the same place the same way: `address` (split into street / ΤΚ /
 * town only when parseStoreAddress can read it unambiguously, otherwise the
 * whole line as streetAddress), `geo` (the listing's pin) and `hasMap` (the
 * listing itself). Empty when no address is set: all three drop out
 * together, the same way the footer hides its map link.
 */
export function storeLocationJsonLd(address: string | null | undefined) {
  const text = address?.replace(/\s*\n+\s*/g, ", ").trim();
  if (!text) return {};
  return {
    address: {
      "@type": "PostalAddress",
      ...(parseStoreAddress(text) ?? { streetAddress: text }),
      addressCountry: "GR",
    },
    geo: { "@type": "GeoCoordinates", ...STORE_GEO },
    hasMap: STORE_MAPS_URL,
  };
}
