"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { HoverPrefetchLink } from "@/components/ui/HoverPrefetchLink";

/**
 * The storefront's <Link>: a drop-in for next/link whose only difference is
 * the prefetch default — on intent (hover, focus, touch) instead of on
 * entering the viewport. Why: HoverPrefetchLink's comment (Vercel Hobby
 * Active CPU, 56 prefetches per homepage visit, measured 2026-10-19).
 *
 * An explicit `prefetch` prop still wins, so a single link can opt back into
 * Next's own behaviour (`prefetch={null}`) or out entirely (`false`).
 *
 * The admin keeps importing next/link directly: it is behind a login, sees
 * a handful of visits a day, and its prefetches cost nothing worth saving.
 */
export default function Link({ prefetch, ...props }: ComponentProps<typeof NextLink>) {
  if (prefetch !== undefined) return <NextLink prefetch={prefetch} {...props} />;
  return <HoverPrefetchLink {...props} />;
}
