/**
 * Google Maps link for the store's free-text address (Settings →
 * contactAddress), shared by the footer and the Contact page so both always
 * point at the same place. A plain search URL — no Place ID or API key.
 * Line breaks become commas, the same flattening the Store JSON-LD applies
 * to this field. Once a Google Business Profile exists, its own share link
 * would tie site and listing together more firmly.
 */
export function googleMapsSearchUrl(address: string | null | undefined): string | null {
  const oneLine = address?.replace(/\s*\n+\s*/g, ", ").trim();
  return oneLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(oneLine)}` : null;
}
