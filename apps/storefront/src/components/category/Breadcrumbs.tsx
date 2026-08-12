import Link from "next/link";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/site-config";

export type Crumb = { label: string; href: string };

export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const withHome: Crumb[] = [{ label: "Αρχική", href: "/" }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: withHome.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: `${siteUrl}${item.href}`,
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="container-shell pt-4 text-sm text-ink-muted">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {withHome.map((item, i) => (
          <li key={item.href} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === withHome.length - 1 ? (
              <span className="text-ink" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-ink hover:underline">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
