import { FREE_SHIPPING_THRESHOLD_EUR } from "@/lib/cart-config";
import { formatPrice } from "@/lib/format";

// Disabled (2026-08-08, CHECKOUT_UX_SPEC.md §0.2): both real Medusa shipping
// options are flat-rate with no conditional discount, so this promise
// wasn't backed by anything — a customer who saw "free shipping" here would
// still be charged the real flat rate at checkout. Explicit user decision:
// soften the cart's message rather than build a real backend rule right
// now. Flip this back to `true` (and nothing else) once a real
// free-shipping rule/promotion exists on the backend.
const FREE_SHIPPING_MESSAGE_ENABLED = false;

// Omitted entirely at zero cart value — nothing to make progress toward yet
// (CART_UX_SPEC.md §11). Threshold is a config value, not hardcoded here.
export function FreeShippingProgress({ subtotalEur }: { subtotalEur: number }) {
  if (!FREE_SHIPPING_MESSAGE_ENABLED || subtotalEur <= 0) return null;

  const reached = subtotalEur >= FREE_SHIPPING_THRESHOLD_EUR;
  const remaining = FREE_SHIPPING_THRESHOLD_EUR - subtotalEur;
  const progress = Math.min(100, (subtotalEur / FREE_SHIPPING_THRESHOLD_EUR) * 100);

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
