// The store's own Google Business Profile listing, as shared by the owner —
// opens the MAVRAKIS HOME place page (reviews, hours, directions) instead of
// a plain address search that could land on the wrong pin.
const STORE_MAPS_URL = "https://maps.app.goo.gl/hsopHgUrjjKZexby6";

/**
 * Google Maps link for the store's address (Settings → contactAddress),
 * shared by the footer and the Contact page so both always point at the same
 * place. Still null when no address is set, so the link hides along with the
 * address it belongs to.
 */
export function storeMapsUrl(address: string | null | undefined): string | null {
  return address?.trim() ? STORE_MAPS_URL : null;
}
