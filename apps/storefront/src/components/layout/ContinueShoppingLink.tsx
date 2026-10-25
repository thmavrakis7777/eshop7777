"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "@/components/ui/Link";
import { lastShoppingPage, markScrollRestore } from "@/lib/last-shopping-page";

// Another tab saving a newer page fires "storage" here; this tab's own
// saves happen on pages that don't show this link.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * «Συνέχεια αγορών» as a link back to the last shopping page, at the
 * position the shopper left it (lib/last-shopping-page.ts). "/" on the
 * server and in the first paint — storage is only readable in the browser,
 * and the homepage is the right answer whenever nothing is stored.
 */
export function ContinueShoppingLink({ className, children = "Συνέχεια αγορών" }: { className?: string; children?: ReactNode }) {
  const href = useSyncExternalStore(subscribe, lastShoppingPage, () => "/");
  return (
    <Link
      href={href}
      className={className}
      // The page restores the scroll itself (RememberShoppingPage); Next's
      // scroll to the top must not run after it.
      scroll={false}
      onClick={() => markScrollRestore(href)}
    >
      {children}
    </Link>
  );
}
