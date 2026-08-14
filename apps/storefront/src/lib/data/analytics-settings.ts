// Analytics/consent provider IDs. The pure helper and the type live in
// lib/content-types.ts because ConsentBanner is a Client Component and must
// not pull the database driver into the browser bundle.
export { getAnalyticsSettings } from "@/lib/db/content";
export { hasAnyAnalyticsService } from "@/lib/content-types";
export type { AnalyticsSettings } from "@/lib/content-types";
