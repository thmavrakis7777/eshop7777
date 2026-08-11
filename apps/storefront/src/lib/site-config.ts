// Placeholder domain until a real one is registered — update here once decided,
// every consumer (metadata, JSON-LD, robots.ts, sitemap.ts) reads from this single source.
export const siteUrl = "https://www.stia.gr";
export const siteName = "STIA";

// Shared between RootLayout's static metadata (used on every page as the
// title-template default) and the homepage's own generateMetadata (used as
// the fallback when no admin SEO override exists) — one source of truth
// instead of the same Greek copy duplicated in two files.
export const siteDefaultTitle = "STIA — Είδη Σπιτιού, Κουζίνας & Μπάνιου";
export const siteDefaultDescription =
  "Ποιοτικά είδη κουζίνας, μπάνιου, αποθήκευσης και κήπου για το σπίτι σου. Γρήγορη παράδοση σε όλη την Ελλάδα.";
