import type { Metadata } from "next";
import Link from "next/link";
import { getOrder } from "@/lib/data/checkout";
import { formatPrice } from "@/lib/format";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";

export const metadata: Metadata = {
  title: "Η παραγγελία σου",
  robots: { index: false, follow: true },
};

const TIMELINE_STEPS = ["Παραλάβαμε την παραγγελία", "Προετοιμασία", "Αποστολή", "Παράδοση"];

// Own URL (not a modal) so it survives a refresh/bookmark, per
// CHECKOUT_UX_SPEC.md §15 — the order ID in the query string is the de
// facto access token, the same trust model most hosted "thank you" pages
// use (confirmed live: /store/orders/:id works for a guest with just the
// publishable key, no session needed).
export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const order = orderId ? await getOrder(orderId) : null;

  if (!order) {
    return (
      <div className="container-shell flex flex-col items-center gap-4 py-16 text-center md:py-24">
        <p className="text-base font-medium text-ink">Δεν βρήκαμε αυτή την παραγγελία.</p>
        <p className="text-sm text-ink-muted">Έλεγξε τον σύνδεσμο ή επικοινώνησε μαζί μας αν χρειάζεσαι βοήθεια.</p>
        <Link href="/" className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent">
          Επιστροφή στην αρχική
        </Link>
      </div>
    );
  }

  return (
    <div className="container-shell py-10 md:py-16">
      <div className="mx-auto flex max-w-xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-2xl text-ink md:text-3xl">Η παραγγελία σου ολοκληρώθηκε.</h1>
          <p className="text-sm text-ink-muted">Παραγγελία #{order.displayId}</p>
        </div>

        <div className="rounded-md border border-border p-5">
          <ul className="flex flex-col gap-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <div className="w-12 shrink-0">
                  <PlaceholderTile label={item.title} tone={item.placeholderTone} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-ink">{item.title}</span>
                  <span className="text-xs text-ink-muted">Ποσ.: {item.quantity}</span>
                </div>
                <span className="shrink-0 text-sm text-ink tabular-nums">{formatPrice(item.total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Υποσύνολο</span>
              <span className="text-ink tabular-nums">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discountTotal.amount > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-muted">Έκπτωση</span>
                <span className="text-ink tabular-nums">−{formatPrice(order.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-ink-muted">Μεταφορικά{order.shippingMethodName ? ` (${order.shippingMethodName})` : ""}</span>
              <span className="text-ink tabular-nums">{formatPrice(order.shippingTotal)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-2.5">
              <span className="text-base font-semibold text-ink">Σύνολο</span>
              <span className="text-lg font-semibold text-ink tabular-nums">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {order.shippingAddress && (
          <div className="flex flex-col gap-1 text-sm">
            <h2 className="font-medium text-ink">Παράδοση σε</h2>
            <p className="text-ink-muted">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.addressLine1}
              {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ""}
              <br />
              {order.shippingAddress.postalCode} {order.shippingAddress.city}
            </p>
          </div>
        )}

        <p className="text-center text-sm text-ink-muted">Σου στείλαμε επιβεβαίωση στο {order.email}</p>

        <div className="flex flex-col gap-3">
          <h2 className="text-center text-sm font-medium text-ink">Τι γίνεται τώρα</h2>
          <ol className="flex flex-col gap-2">
            {TIMELINE_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${
                    i === 0 ? "bg-ink text-white" : "bg-surface-strong text-ink-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={i === 0 ? "text-ink" : "text-ink-muted"}>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col items-center gap-4 border-t border-border pt-6">
          <Link href="/" className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent">
            Συνέχεια αγορών
          </Link>
          <p className="text-center text-sm text-ink-muted">
            Χρειάζεσαι βοήθεια; <Link href="/epikoinonia" className="text-accent hover:underline">Επικοινώνησε μαζί μας</Link>
          </p>
          <p className="text-center text-xs text-ink-muted">
            Θέλεις να δημιουργήσεις λογαριασμό για τις επόμενες παραγγελίες;{" "}
            <Link href="/logariasmos" className="text-accent hover:underline">Δημιουργία λογαριασμού</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
