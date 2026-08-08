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
};

export default nextConfig;
