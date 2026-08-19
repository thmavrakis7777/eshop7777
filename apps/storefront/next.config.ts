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
  images: { remotePatterns },
};

export default nextConfig;
