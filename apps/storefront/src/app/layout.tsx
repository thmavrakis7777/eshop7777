import type { Metadata } from "next";
import { Inter, Literata } from "next/font/google";
import "./globals.css";
import { siteDefaultDescription, siteDefaultTitle, siteName, siteUrl } from "@/lib/site-config";

/**
 * The document shell, and nothing else.
 *
 * Storefront chrome (header, footer, cart drawer, analytics, consent) lives
 * in (storefront)/layout.tsx, not here — the admin is a sibling route tree
 * and must NOT inherit it. Before this split the admin rendered with the
 * shop's header and cart icon sitting above its own sidebar, which is what
 * prompted the change.
 *
 * This layout also does no data fetching, so /admin no longer pays for a nav
 * query, a cart lookup and three settings reads on every page view.
 */

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "greek"], display: "swap" });
const literata = Literata({ variable: "--font-literata", subsets: ["latin", "greek"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // The literal used to be "%s | STIA", a second hardcoded copy of the shop
  // name that a rename could not reach. This is only the build-time/fallback
  // template — the storefront layout overrides it with the admin-set name —
  // so it reads from the same constant as everything else here.
  title: { default: siteDefaultTitle, template: `%s | ${siteName}` },
  description: siteDefaultDescription,
  openGraph: {
    type: "website",
    locale: "el_GR",
    siteName,
    title: siteDefaultTitle,
    description: "Ποιοτικά είδη κουζίνας, μπάνιου, αποθήκευσης και κήπου για το σπίτι σου.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: siteDefaultTitle,
    description: "Ποιοτικά είδη κουζίνας, μπάνιου, αποθήκευσης και κήπου για το σπίτι σου.",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="el"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${literata.variable} antialiased`}
    >
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
