import { formatPrice } from "@/lib/format";

// Re-enabled once a real, admin-configurable free-shipping rule existed to
// back it (shop.shipping_method.free_over_cents — see Admin → Ρυθμίσεις →
// Αποστολές). Previously this rendered a promise backed by nothing but an
// env var (CHECKOUT_UX_SPEC.md §0.2), which could show "free shipping" while
// checkout charged the real flat rate — deliberately disabled until that was
// fixed rather than left showing a number nobody set.
//
// Deliberately NOT Heraklion-aware: the cart page/drawer never has a
// delivery address (that only exists once checkout starts), so it can only
// ever show the ONE rule that applies regardless of address — the shared
// nationwide threshold, read from the dashboard via
// getNationwideFreeShippingThresholdCents. The Heraklion-specific version of
// this message lives in ShippingSection.tsx, where an address is actually
// known.
//
// Omitted entirely at zero cart value — nothing to make progress toward yet
// (CART_UX_SPEC.md §11) — and when no nationwide threshold is configured.
export function FreeShippingProgress({
  subtotalEur,
  thresholdCents,
}: {
  subtotalEur: number;
  thresholdCents: number | null;
}) {
  if (thresholdCents == null || subtotalEur <= 0) return null;
  const thresholdEur = thresholdCents / 100;

  const reached = subtotalEur >= thresholdEur;
  const remaining = thresholdEur - subtotalEur;
  const progress = Math.min(100, (subtotalEur / thresholdEur) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-ink-muted">
        {reached ? (
          <span className="font-medium text-ink">Έχεις ΔΩΡΕΑΝ μεταφορικά 🎉</span>
        ) : (
          <>
            Ακόμα <span className="font-medium text-ink">{formatPrice({ amount: remaining, currencyCode: "EUR" })}</span> για ΔΩΡΕΑΝ μεταφορικά
          </>
        )}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
