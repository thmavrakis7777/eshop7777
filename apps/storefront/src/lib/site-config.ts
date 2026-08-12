// Real domain still not registered (placeholder below). Every consumer
// (metadata, JSON-LD, robots.ts, sitemap.ts) reads from this single source,
// so canonical/sitemap/OG URLs must never point at a domain that isn't
// actually serving the site — that breaks indexing outright, worse than an
// ugly URL. Resolution order: an explicit real domain (NEXT_PUBLIC_SITE_URL,
// set once a real domain exists) > Vercel's own deployment URL (auto-set by
// Vercel on every deploy, so production is always correct with zero extra
// config even before a custom domain is attached) > the placeholder, for
// local dev only.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.stia.gr");
export const siteName = "STIA";

// Shared between RootLayout's static metadata (used on every page as the
// title-template default) and the homepage's own generateMetadata (used as
// the fallback when no admin SEO override exists) — one source of truth
// instead of the same Greek copy duplicated in two files.
export const siteDefaultTitle = "STIA — Είδη Σπιτιού, Κουζίνας & Μπάνιου";
export const siteDefaultDescription =
  "Ποιοτικά είδη κουζίνας, μπάνιου, αποθήκευσης και κήπου για το σπίτι σου. Γρήγορη παράδοση σε όλη την Ελλάδα.";
