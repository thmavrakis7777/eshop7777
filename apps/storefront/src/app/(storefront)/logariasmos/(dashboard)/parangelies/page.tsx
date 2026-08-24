import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCustomerOrders } from "@/lib/data/customer";
import { formatPrice } from "@/lib/format";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";

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
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border py-12 text-center">
          <p className="text-sm text-ink-muted">Δεν έχεις κάνει ακόμα καμία παραγγελία.</p>
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            Συνέχεια αγορών
          </Link>
        </div>
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
                className="flex items-center gap-4 rounded-sm border border-border p-4 transition-colors hover:border-ink"
              >
                <div className="relative w-14 shrink-0 overflow-hidden rounded-sm">
                  {order.items[0]?.imageUrl ? (
                    <Image
                      src={order.items[0].imageUrl}
                      alt={order.items[0].title}
                      width={56}
                      height={56}
                      className="h-14 w-14 object-cover"
                      unoptimized
                    />
                  ) : (
                    <PlaceholderTile label={order.items[0]?.title ?? ""} tone={order.items[0]?.placeholderTone ?? "stone"} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">Παραγγελία #{order.displayId}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
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
