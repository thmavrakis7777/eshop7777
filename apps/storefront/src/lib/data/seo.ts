// Admin-editable SEO overrides, one shared shape across every resource type
// since the editable field set is identical for all of them.
export { getSeoOverride } from "@/lib/db/content";
export type { SeoOverride, SeoResourceType } from "@/lib/db/content";
