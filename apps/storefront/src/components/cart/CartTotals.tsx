import Link from "next/link";
import type { Cart } from "@/lib/types";
import { formatPrice } from "@/lib/format";

// Shared by the drawer, the full cart page, and checkout's order summary —
// was duplicated inline before the clarity pass. Dual-purpose by design:
// pre-checkout, no shipping method exists yet, so "Μεταφορικά" honestly
// says so rather than showing a fake 0,00€ (Medusa doesn't calculate real
// shipping until a method is chosen — see CART_UX_SPEC.md's error-copy
// stance for the same principle applied elsewhere). Once checkout adds a
// real shipping method to the cart (`cart.hasShippingMethod`), this shows
// the real amount and total instead — same component, no fork needed.
export function CartTotals({ cart }: { cart: Cart }) {
  // The total is always correct either way (lib/db/cart.ts computes it
  // whether or not the UI explains it) — this only decides whether to show
  // *why* it's higher, per the compliance requirement that an oversized-item
  // surcharge must be understandable, not just a bigger number. Gated on a
  // real non-zero shippingTotal too: a Heraklion cart clearing that method's
  // free-shipping threshold charges €0 even with a heavy/bulky item, and
  // this note would otherwise wrongly claim a surcharge is included.
  const hasOversizedItem = cart.items.some((i) => i.hasExtraShipping) && cart.shippingTotal.amount > 0;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between">
        <span className="text-ink-muted">Υποσύνολο</span>
        <span className="text-ink tabular-nums">{formatPrice(cart.subtotal)}</span>
      </div>
      {cart.discountTotal.amount > 0 && (
        <div className="flex justify-between">
          <span className="text-ink-muted">Έκπτωση</span>
          <span className="text-ink tabular-nums">−{formatPrice(cart.discountTotal)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-ink-muted">Μεταφορικά</span>
        {cart.hasShippingMethod ? (
          <span className="text-ink tabular-nums">{formatPrice(cart.shippingTotal)}</span>
        ) : (
          <span className="text-ink-muted">Υπολογίζεται στο checkout</span>
        )}
      </div>
      {cart.hasShippingMethod && hasOversizedItem && (
        <p className="text-xs text-ink-muted">
          Περιλαμβάνει πρόσθετη χρέωση μεταφορικών για ογκώδες/βαρύ προϊόν στο καλάθι σου — δείτε τη{" "}
          <Link href="/apostoles" className="underline underline-offset-2 hover:text-ink">
            σελίδα Αποστολών
          </Link>
          .
        </p>
      )}
      <div className="flex items-baseline justify-between border-t border-border pt-2.5">
        <span className="text-base font-semibold text-ink">Σύνολο</span>
        <span className="text-lg font-semibold text-ink tabular-nums">{formatPrice(cart.total)}</span>
      </div>
      {/* Greek retail prices are VAT-inclusive by law, so this is a breakdown
          of the total above — never an amount added to it. */}
      <p className="text-xs text-ink-muted">
        Στην τιμή περιλαμβάνεται ΦΠΑ {cart.vatRate}% ({formatPrice(cart.vatTotal)})
      </p>
      {!cart.hasShippingMethod && (
        <p className="text-xs text-ink-muted">Τα μεταφορικά υπολογίζονται στο επόμενο βήμα.</p>
      )}
    </div>
  );
}
