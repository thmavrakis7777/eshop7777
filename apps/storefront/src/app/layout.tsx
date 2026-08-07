import type { Metadata } from "next";
import { Inter, Literata } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

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

const siteUrl = "https://www.stia.gr";

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
    siteName: "STIA",
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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "STIA",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  sameAs: [],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer service",
      areaServed: "GR",
      availableLanguage: ["el", "en"],
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
        <AnnouncementBar />
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
