"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A <Link> that prefetches only once *this* link shows intent (pointer over
 * it, keyboard focus, or a finger landing on it), instead of the moment it
 * enters the viewport — Next's documented hover-prefetch pattern
 * (guides/prefetching.md).
 *
 * Started life for link-dense panels: opening one desktop mega menu puts ~60
 * category links on screen, and one hover fired ~60 serverless requests
 * (Speed audit PERF-010/SPD-13, measured live). Since 2026-10-19 it is the
 * storefront's default link too (components/ui/Link.tsx): every storefront
 * route renders dynamically, so viewport prefetching made one homepage visit
 * cost ~57 function runs (56 background prefetches measured live) and pushed
 * the Vercel Hobby team to 75% of its 4 h monthly Active CPU in October.
 * The link actually pointed at still prefetches before the click lands, so
 * its loading skeleton is still instant — just without the others.
 *
 * Touch: phones have no hover, so `touchstart` stands in for it. It fires
 * ~100 ms before the click, which is enough to start the request early.
 */
export function HoverPrefetchLink({
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      // null = Next's default ("auto"), which kicks in right away because
      // the link is already on screen. false = never, not even on hover —
      // which is why the switch has to be ours.
      prefetch={intent ? null : false}
      onPointerEnter={(e) => {
        setIntent(true);
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
    />
  );
}
