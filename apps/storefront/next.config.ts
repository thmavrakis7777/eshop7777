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

// Medusa's default local file provider serves uploaded product photos from
// its own /static path — no real photography exists yet, but every product
// image consumer (ProductCard, SearchResultRow) already renders one
// correctly the moment a thumbnail is set. Revisit this pattern if the file
// provider ever moves to S3/a CDN. Always allows local dev; also allows the
// production backend host (Railway) derived from the same env var the data
// layer uses, so a new deploy never needs a manual images-config edit here.
const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  { protocol: "http", hostname: "localhost", port: "9000", pathname: "/static/**" },
];
const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
if (backendUrl && !backendUrl.includes("localhost")) {
  const parsed = new URL(backendUrl);
  remotePatterns.push({
    protocol: parsed.protocol.replace(":", "") as "http" | "https",
    hostname: parsed.hostname,
    port: parsed.port || undefined,
    pathname: "/static/**",
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
