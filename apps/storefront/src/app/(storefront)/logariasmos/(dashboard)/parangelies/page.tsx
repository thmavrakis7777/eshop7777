import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerOrders } from "@/lib/data/customer";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Παραγγελίες",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/parangelies" },
};

const DATE_FORMATTER = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "long", year: "numeric" });

export default async function OrdersPage() {
  const orders = await getCustomerOrders();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">Παραγγελίες</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-ink-muted">Δεν έχεις κάνει ακόμα καμία παραγγελία.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              {/* Reuses the guest order-confirmation page as the order-detail
                  view — a real, already-built detail page rather than a new
                  one. Safe to link to directly: getOrder/getOrderById only
                  return a customer-owned order (this list is already scoped
                  to the current session) to that same customer's session,
                  never via the uuid alone. */}
              <Link
                href={`/checkout/epibebaiosi?order=${order.id}`}
                className="flex items-center justify-between gap-4 rounded-sm border border-border p-4 transition-colors hover:border-ink"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink">Παραγγελία #{order.displayId}</span>
                  <span className="text-xs text-ink-muted">{DATE_FORMATTER.format(new Date(order.createdAt))}</span>
                  <span className="text-xs text-ink-muted">{order.items.length} προϊόντα</span>
                </div>
                <span className="shrink-0 text-sm font-medium text-ink tabular-nums">{formatPrice(order.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
