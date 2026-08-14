// Static content pages (About/Shipping/Returns/…). Slug is one of a fixed set
// with a matching literal route folder — not an open-ended CMS slug.
// Unpublished pages are filtered in the query, so an unpublished page's body
// never reaches this layer at all.
export { getContentPage } from "@/lib/db/content";
export type { ContentPage } from "@/lib/db/content";
