import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getOrder } from "@/lib/data/checkout";
import { getCustomerId } from "@/lib/data/customer";
import { formatPrice } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/order-status-labels";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";
import { PurchaseTracker } from "@/components/checkout/PurchaseTracker";

// The explicit canonical matters even on a noindex page: without it this
// route inherits the root layout's `canonical: "/"` and tells crawlers the
// order confirmation *is* the homepage.
export const metadata: Metadata = {
  title: "Η παραγγελία σου",
  robots: { index: false, follow: true },
  alternates: { canonical: "/checkout/epibebaiosi" },
};

const TIMELINE_STEPS = ["Παραλάβαμε την παραγγελία", "Προετοιμασία", "Αποστολή", "Παράδοση"];

// Own URL (not a modal) so it survives a refresh/bookmark, per
// CHECKOUT_UX_SPEC.md §15 — the order ID in the query string is the de facto
// access token for a *guest* order, the same trust model most hosted "thank
// you" pages use. A customer-owned order additionally requires the viewer's
// own session to match (getOrder/getOrderById) — see the security-audit note
// there for why the uuid alone isn't enough once an order is tied to a
// persistent account.
export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const customerId = await getCustomerId();
  const order = orderId ? await getOrder(orderId, customerId) : null;

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
      <PurchaseTracker orderId={order.id} totalAmount={order.total.amount} />
      <div className="mx-auto flex max-w-xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-2xl text-ink md:text-3xl">Η παραγγελία σου ολοκληρώθηκε.</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-ink-muted">Παραγγελία #{order.displayId}</p>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        <div className="rounded-md border border-border p-5">
          <ul className="flex flex-col gap-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <div className="relative w-12 shrink-0 overflow-hidden rounded-sm">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.title} width={48} height={48} className="h-12 w-12 object-cover" unoptimized />
                  ) : (
                    <PlaceholderTile label={item.title} tone={item.placeholderTone} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-ink">{item.title}</span>
                  {item.variantTitle && <span className="text-xs text-ink-muted">{item.variantTitle}</span>}
                  <span className="text-xs text-ink-muted">
                    Ποσ.: {item.quantity} × {formatPrice(item.unitPrice)}
                    {item.sku && <span className="font-mono"> · {item.sku}</span>}
                  </span>
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

        {order.loyaltyReward && (
          <div className="rounded-md border border-accent/30 bg-accent/5 p-4 text-center text-sm text-ink">
            Κέρδισες ένα κουπόνι έκπτωσης 5€ για την επόμενη παραγγελία σου:{" "}
            <code className="rounded-sm bg-surface-strong px-2 py-0.5 font-mono font-medium text-ink">
              {order.loyaltyReward.code}
            </code>
            {order.loyaltyReward.endsAt && (
              <span className="block text-xs text-ink-muted">
                Ισχύει έως {new Intl.DateTimeFormat("el-GR", { dateStyle: "medium" }).format(new Date(order.loyaltyReward.endsAt))}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <h2 className="font-medium text-ink">Τρόπος πληρωμής</h2>
            <p className="text-ink-muted">{paymentMethodLabel(order.paymentMethod)}</p>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-medium text-ink">Κατάσταση πληρωμής</h2>
            <OrderStatusBadge status={order.paymentStatus} kind="payment" />
          </div>
        </div>

        {order.courierName && order.trackingCode && (
          <div className="flex flex-col gap-2 rounded-md bg-surface p-4 text-sm">
            <h2 className="font-medium text-ink">Στοιχεία αποστολής</h2>
            <div className="flex justify-between">
              <span className="text-ink-muted">Εταιρεία μεταφοράς</span>
              <span className="font-medium text-ink">{order.courierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Κωδικός αποστολής</span>
              <span className="font-mono text-ink">{order.trackingCode}</span>
            </div>
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 self-start rounded-sm bg-ink px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent"
              >
                Παρακολούθηση αποστολής
              </a>
            )}
          </div>
        )}

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

        {order.billingAddress &&
          (order.billingAddress.addressLine1 !== order.shippingAddress?.addressLine1 ||
            order.billingAddress.postalCode !== order.shippingAddress?.postalCode) && (
            <div className="flex flex-col gap-1 text-sm">
              <h2 className="font-medium text-ink">Στοιχεία χρέωσης</h2>
              <p className="text-ink-muted">
                {order.billingAddress.fullName}
                <br />
                {order.billingAddress.addressLine1}
                {order.billingAddress.addressLine2 ? `, ${order.billingAddress.addressLine2}` : ""}
                <br />
                {order.billingAddress.postalCode} {order.billingAddress.city}
              </p>
            </div>
          )}

        <div className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium text-ink">Παραστατικό</h2>
          {order.taxDocumentType === "invoice" && order.invoiceDetails ? (
            <p className="text-ink-muted">
              Τιμολόγιο — {order.invoiceDetails.companyName}
              <br />
              ΑΦΜ: {order.invoiceDetails.afm} · ΔΟΥ: {order.invoiceDetails.doy}
              <br />
              {order.invoiceDetails.activity}
            </p>
          ) : (
            <p className="text-ink-muted">Απόδειξη</p>
          )}
        </div>

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
          {!customerId && (
            <p className="text-center text-xs text-ink-muted">
              Θέλεις να δημιουργήσεις λογαριασμό για τις επόμενες παραγγελίες;{" "}
              <Link href="/logariasmos" className="text-accent hover:underline">Δημιουργία λογαριασμού</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
