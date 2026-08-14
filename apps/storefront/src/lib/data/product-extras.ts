// Per-product merchandising extras (custom badge, warranty text, downloads).
// These are plain columns on shop.product now — Medusa needed a side table
// keyed by product id because its Product model had nowhere to put them.
export { getProductExtra } from "@/lib/db/content";
export type { ProductExtra } from "@/lib/db/content";
