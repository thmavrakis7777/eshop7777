// The real domain (mavrakishome.gr) is registered and live. Every consumer
// (metadata, JSON-LD, robots.ts, sitemap.ts, and — critically — the
// password-reset email link in lib/email/send.ts) reads from this single
// source, so canonical/sitemap/OG/email URLs must never point at a domain
// that isn't actually serving the site: for a reset-password link specifically,
// a wrong fallback here doesn't just break SEO, it sends a customer to a
// domain this business may not even control. Resolution order: an explicit
// real domain (NEXT_PUBLIC_SITE_URL) > Vercel's own per-deployment URL
// (VERCEL_URL — note this is the deployment hash URL, NOT a custom domain
// attached in Vercel, so it only helps before a custom domain exists) > the
// hardcoded fallback below, which should always be the real production
// domain, not a placeholder.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.mavrakishome.gr");
export const siteName = "MAVRAKIS HOME";

// Shared between RootLayout's static metadata (used on every page as the
// title-template default) and the homepage's own generateMetadata (used as
// the fallback when no admin SEO override exists) — one source of truth
// instead of the same Greek copy duplicated in two files.
export const siteDefaultTitle = "MAVRAKIS HOME — Είδη Σπιτιού, Κουζίνας & Μπάνιου";
export const siteDefaultDescription =
  "Ποιοτικά είδη κουζίνας, μπάνιου, αποθήκευσης και κήπου για το σπίτι σου. Γρήγορη παράδοση σε όλη την Ελλάδα.";
