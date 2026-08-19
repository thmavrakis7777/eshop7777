import type { Metadata } from "next";

// Metadata only — deliberately NO auth check here. The login page lives at
// /admin/login and layouts nest, so putting the session gate at this level
// would wrap the login page too and redirect it to itself forever. The gate
// lives in (protected)/layout.tsx instead, which covers every real admin page
// while leaving /admin/login reachable.
export const metadata: Metadata = {
  // Generic on purpose: this is a browser-tab string on noindex pages, and
  // making it dynamic would force a database read into the admin root layout,
  // which is deliberately data-free. The visible shell shows the real name.
  // `absolute`, not `default`: the root layout.tsx (shared with the
  // storefront) wraps a plain `default` string in ITS OWN "%s | {siteName}"
  // template too, since layouts chain — so without `absolute` every admin
  // page read "… · Διαχείριση | STIA", the exact hardcoded-brand leak the
  // storefront side of this already got fixed for (getBranding()). `absolute`
  // stops that chain here; this layout's own template still applies to any
  // child admin page's own plain-string title (e.g. "Σελίδες · Διαχείριση").
  title: { absolute: "Διαχείριση", template: "%s · Διαχείριση" },
  // noindex travels with the response itself, alongside the robots.ts rule.
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
