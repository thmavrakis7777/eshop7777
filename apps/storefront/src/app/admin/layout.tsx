import type { Metadata } from "next";

// Metadata only — deliberately NO auth check here. The login page lives at
// /admin/login and layouts nest, so putting the session gate at this level
// would wrap the login page too and redirect it to itself forever. The gate
// lives in (protected)/layout.tsx instead, which covers every real admin page
// while leaving /admin/login reachable.
export const metadata: Metadata = {
  title: { default: "Διαχείριση", template: "%s · STIA Admin" },
  // noindex travels with the response itself, alongside the robots.ts rule.
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
