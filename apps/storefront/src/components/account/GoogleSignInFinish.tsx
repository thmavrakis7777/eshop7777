"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { mergeWishlistOnLoginAction } from "@/lib/actions/wishlist";
import { getWishlistSnapshot } from "@/lib/wishlist-storage";

// Same post-login wishlist step LoginForm/RegisterForm run, for a Google
// sign-in that arrived by redirect instead of a form. Best-effort: a failed
// merge still continues, because the sign-in itself already succeeded. The
// ref keeps React's development double-run of effects from merging twice.
export function GoogleSignInFinish({ to }: { to: string }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        await mergeWishlistOnLoginAction(getWishlistSnapshot());
      } catch {
        // Non-critical — the account's own wishlist still loads normally.
      }
      router.replace(to);
    })();
  }, [router, to]);

  return (
    <p role="status" className="text-sm text-ink-muted">
      Σύνδεση…
    </p>
  );
}
