// Site-wide settings singleton. Now a row in shop.site_setting rather than a
// custom Medusa module; the type and the never-throw contract are unchanged,
// which is why RootLayout and the Footer needed no edits.
export { getSiteSettings } from "@/lib/db/content";
export type { SiteSettings } from "@/lib/db/content";
