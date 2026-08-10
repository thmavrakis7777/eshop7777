import type { Metadata } from "next";
import { Inter, Literata } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartUIProvider } from "@/components/cart/CartUIProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AddToCartToast } from "@/components/cart/AddToCartToast";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import { siteName, siteUrl } from "@/lib/site-config";
import { getNavCategories } from "@/lib/data/categories";
import { getCart } from "@/lib/data/cart";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "greek"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "greek"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "STIA — Είδη Σπιτιού, Κουζίνας & Μπάνιου",
    template: "%s | STIA",
  },
  description:
    "Ποιοτικά είδη κουζίνας, μπάνιου, αποθήκευσης και κήπου για το σπίτι σου. Γρήγορη παράδοση σε όλη την Ελλάδα.",
  openGraph: {
    type: "website",
    locale: "el_GR",
    siteName,
    title: "STIA — Είδη Σπιτιού, Κουζίνας & Μπάνιου",
    description:
      "Ποιοτικά είδη κουζίνας, μπάνιου, αποθήκευσης και κήπου για το σπίτι σου.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "STIA — Είδη Σπιτιού, Κουζίνας & Μπάνιου",
    description:
      "Ποιοτικά είδη κουζίνας, μπάνιου, αποθήκευσης και κήπου για το σπίτι σου.",
  },
  alternates: {
    canonical: "/",
  },
};

// No `logo`/`sameAs` yet — there's no real logo asset or social presence to
// point to. Add both once brand assets and social accounts exist; a broken
// logo URL in JSON-LD is worse for SEO than omitting the field.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer service",
      areaServed: "GR",
      availableLanguage: ["el", "en"],
    },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [categories, cart] = await Promise.all([getNavCategories(), getCart()]);

  return (
    <html lang="el" className={`${inter.variable} ${literata.variable} antialiased`}>
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <a href="#main-content" className="sr-only-focusable fixed left-4 top-4 z-50 rounded-sm bg-ink px-4 py-2 text-sm text-white">
          Μετάβαση στο περιεχόμενο
        </a>
        <WishlistProvider>
          <CartUIProvider>
            <AnnouncementBar />
            <Header
              categories={categories}
              cartItemCount={cart?.itemCount ?? 0}
              cartTotal={cart?.total ?? { amount: 0, currencyCode: "EUR" }}
            />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer categories={categories} />
            <CartDrawer />
            <AddToCartToast />
          </CartUIProvider>
        </WishlistProvider>
      </body>
    </html>
  );
}
