import type { NextConfig } from "next";

// Baseline security headers. Content-Security-Policy is deliberately not
// here — it needs a fresh nonce per request, which a static header list
// can't produce; see src/proxy.ts for the real CSP (nonce'd JSON-LD
// scripts, analytics scripts, strict-dynamic). Strict-Transport-Security is
// left to the hosting layer (Vercel adds it automatically for production
// https deployments).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// Product photos live in Supabase Storage (lib/storage/urls.ts derives the
// public URL from NEXT_PUBLIC_SUPABASE_URL) — no real photography exists yet
// (publicImageUrl returns null until it's configured, and every image
// consumer already falls back to PlaceholderTile), but this pattern needs to
// be in place before the first real upload, not discovered as a broken-image
// bug after.
const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
// .trim(): a pasted dashboard env var can carry a trailing newline (confirmed
// live) — new URL() already tolerates that here, but trimming keeps this
// consistent with the same guard in lib/storage/urls.ts and upload.ts.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
if (supabaseUrl) {
  const parsed = new URL(supabaseUrl);
  remotePatterns.push({
    protocol: "https",
    hostname: parsed.hostname,
    pathname: "/storage/v1/object/public/**",
  });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Category SEO taxonomy fix (see scratch/seo-taxonomy-*.sql): 3 main
  // categories had slugs left over from a previous name (ΚΗΠΟΣ/ΥΓΡΑΕΡΙΟ/
  // ΕΡΓΑΛΕΙΑ), and 8 legacy subcategories that were never part of the
  // approved taxonomy were deleted outright rather than kept. These 301s
  // point already-indexed URLs at the closest surviving page instead of
  // breaking them: the 3 renamed-slug parents' remaining children first
  // (before the parent's own catch-all, so Next.js's first-match-wins
  // doesn't send a deleted child down the wrong path), then the deleted
  // leaves that hung directly off ΚΟΥΖΙΝΑ/ΜΠΑΝΙΟ/ΚΗΠΟΣ (slugs unchanged,
  // so only the deleted leaf itself needs a rule).
  async redirects() {
    return [
      // Specific overrides MUST precede their catch-all counterpart below —
      // Next.js uses first-match-wins, and these 2 children were deleted
      // (not moved), so the general /eidi-spitiou/:path* rule would
      // otherwise send them to a page that doesn't exist.
      { source: "/eidi-spitiou/diakosmisi", destination: "/spiti-organosi", permanent: true },
      { source: "/eidi-spitiou/yfasmata-spitiou", destination: "/spiti-organosi", permanent: true },
      { source: "/eidi-spitiou", destination: "/ergaleia", permanent: true },
      { source: "/eidi-spitiou/:path*", destination: "/ergaleia/:path*", permanent: true },
      { source: "/katharismos/plysimo-siderosma", destination: "/spiti-organosi", permanent: true },
      { source: "/katharismos/skoupes-ergaleia", destination: "/spiti-organosi", permanent: true },
      { source: "/katharismos", destination: "/spiti-organosi", permanent: true },
      { source: "/katharismos/:path*", destination: "/spiti-organosi/:path*", permanent: true },
      { source: "/kipos/exoterikos-choros", destination: "/kipos", permanent: true },
      { source: "/kouzina/axesouar-kouzinas", destination: "/kouzina", permanent: true },
      { source: "/banio/axesouar-baniou", destination: "/banio", permanent: true },
      { source: "/banio/petsetes-yfasmata", destination: "/banio", permanent: true },
      // Ηλεκτρολογικά kept its old "fotismos" ("lighting") slug when it was
      // renamed from Φωτισμός during the same taxonomy fix — cosmetic, but a
      // real mismatch. Children first, same first-match-wins reasoning above.
      { source: "/ergaleia/fotismos/:path*", destination: "/ergaleia/ilektrologika/:path*", permanent: true },
      { source: "/ergaleia/fotismos", destination: "/ergaleia/ilektrologika", permanent: true },
    ];
  },
  // AVIF first, WebP as the fallback modern format — next/image already
  // negotiates via the request's Accept header, this only adds AVIF to what
  // it's allowed to serve (WebP was already the framework default; AVIF was
  // not). Every `next/image` call site across the app gets this for free,
  // no per-component change needed.
  images: { remotePatterns, formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
