"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A <Link> that prefetches only once *this* link shows intent (pointer over
 * it, or keyboard focus), instead of the moment it enters the viewport —
 * Next's documented hover-prefetch pattern (guides/prefetching.md).
 *
 * For link-dense panels that appear all at once. Opening one desktop mega
 * menu puts ~60 category links on screen, and since category routes gained
 * loading.tsx skeletons each of those is prefetchable: one hover fired ~60
 * serverless requests (Speed audit PERF-010/SPD-13, measured live). With
 * this, the link actually pointed at still prefetches before the click
 * lands, so its skeleton is still instant — just without the other 59.
 *
 * Don't use it for ordinary in-page links: a product card or a breadcrumb
 * is exactly what viewport prefetching is for.
 */
export function HoverPrefetchLink({
  onPointerEnter,
  onFocus,
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
    />
  );
}
