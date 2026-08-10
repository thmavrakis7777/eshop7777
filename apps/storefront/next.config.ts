import type { NextConfig } from "next";

// Baseline security headers. Deliberately no Content-Security-Policy yet:
// the app emits inline JSON-LD <script> tags (Organization, Product,
// BreadcrumbList), so a real CSP needs per-request nonces wired through
// those — worth doing, but it's its own change, not a header list.
// Strict-Transport-Security is left to the hosting layer since no
// deployment target is decided yet.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Medusa's default local file provider serves uploaded product photos
    // from its own /static path — no real photography exists yet, but every
    // product image consumer (ProductCard, SearchResultRow) already renders
    // one correctly the moment a thumbnail is set. Revisit this pattern if
    // the file provider ever moves to S3/a CDN.
    remotePatterns: [{ protocol: "http", hostname: "localhost", port: "9000", pathname: "/static/**" }],
  },
};

export default nextConfig;
