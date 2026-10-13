import type { ReactNode } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getRenamedProductSlug, productExists } from "@/lib/data/products";

/**
 * Exists only to keep a missing product a real HTTP 404.
 *
 * The sibling loading.tsx wraps page.tsx in a Suspense boundary so a tap on
 * a product link shows a skeleton at once (Speed audit SPD-04). Once that
 * boundary streams, the status line has already gone out as 200 — a
 * notFound() inside the page could then only add a noindex tag (a "soft
 * 404"). A layout in the same folder sits *outside* its loading.tsx, so
 * this check finishes before anything streams and Next can still send 404.
 * The page keeps its own notFound() as a safety net for the few seconds a
 * just-deactivated product can still be in the cached slug list.
 *
 * The same holds for a product whose slug was changed in the dashboard: its
 * old URL gets a real 308 to the current one (migration 0040), sent from
 * here for the same reason, so search engines move the page's standing
 * across instead of dropping it as a 404.
 *
 * Prefetches of product links run this too, which is why it reads the
 * cached slug list rather than the product itself — see productExists().
 */
export default async function ProductExistsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  if (!(await productExists(handle))) {
    const currentSlug = await getRenamedProductSlug(handle);
    if (currentSlug) permanentRedirect(`/proionta/${currentSlug}`);
    notFound();
  }
  return children;
}
