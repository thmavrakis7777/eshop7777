import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { getOrderDetail } from "@/lib/admin/orders";
import { OrderStatusControls } from "@/components/admin/OrderStatusControls";
import { ShipmentControls } from "@/components/admin/ShipmentControls";
import { DeleteOrderControls } from "@/components/admin/DeleteOrderControls";
import {
  Card,
  PageHeader,
  SectionTitle,
  StatusBadge,
  formatDateTime,
  money,
} from "@/components/admin/ui/primitives";

export const metadata = { title: "Παραγγελία" };

const EVENT_LABELS: Record<string, string> = {
  created: "Δημιουργία",
  status: "Κατάσταση",
  payment: "Πληρωμή",
  fulfillment: "Εκτέλεση",
  shipment_info: "Στοιχεία αποστολής",
  email_confirmation: "Email επιβεβαίωσης",
  email_shipment: "Email αποστολής",
};

function Address({ address }: { address: Record<string, string | null> | null }) {
  if (!address) return <p className="text-sm text-ink-muted">—</p>;
  const name = [address.first_name, address.last_name].filter(Boolean).join(" ");
  return (
    <address className="text-sm not-italic text-ink">
      {name && <div>{name}</div>}
      <div>{address.address_1}</div>
      {address.address_2 && <div>{address.address_2}</div>}
      <div>
        {address.postal_code} {address.city}
      </div>
      {address.phone && <div className="text-ink-muted">{address.phone}</div>}
    </address>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, admin] = await Promise.all([getOrderDetail(id), getAdminUser()]);
  if (!order) notFound();

  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  // Prices are VAT-inclusive, so this is the net figure implied by the total,
  // shown alongside the VAT line rather than instead of it.
  const netCents = order.totalCents - order.vatCents;

  return (
    <>
      <PageHeader
        title={`Παραγγελία #${order.orderNumber}`}
        description={formatDateTime(order.createdAt)}
        breadcrumb={[{ label: "Παραγγελίες", href: "/admin/orders" }, { label: `#${order.orderNumber}` }]}
        action={
          <div className="flex gap-2">
            <StatusBadge value={order.status} kind="order" />
            <StatusBadge value={order.paymentStatus} kind="payment" />
            <StatusBadge value={order.fulfillmentStatus} kind="fulfillment" />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-5">
          <section>
            <SectionTitle hint={`${itemCount} τεμάχια`}>Προϊόντα</SectionTitle>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-border bg-surface px-4 py-2.5 text-left text-xs font-semibold text-ink-muted">
                      Προϊόν
                    </th>
                    <th scope="col" className="border-b border-border bg-surface px-4 py-2.5 text-right text-xs font-semibold text-ink-muted">
                      Ποσ.
                    </th>
                    <th scope="col" className="border-b border-border bg-surface px-4 py-2.5 text-right text-xs font-semibold text-ink-muted">
                      Τιμή
                    </th>
                    <th scope="col" className="border-b border-border bg-surface px-4 py-2.5 text-right text-xs font-semibold text-ink-muted">
                      Σύνολο
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border-b border-border px-4 py-3">
                        {/* The snapshot is authoritative — the link is a
                            convenience and is omitted if the product is gone. */}
                        {item.productId ? (
                          <Link href={`/admin/products/${item.productId}`} className="font-medium text-ink hover:text-accent">
                            {item.title}
                          </Link>
                        ) : (
                          <span className="font-medium text-ink">{item.title}</span>
                        )}
                        {item.sku && <div className="font-mono text-xs text-ink-muted">{item.sku}</div>}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="border-b border-border px-4 py-3 text-right tabular-nums text-ink-muted">
                        {money(item.unitPriceCents)}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-right font-medium tabular-nums">
                        {money(item.lineTotalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 ml-auto flex max-w-xs flex-col gap-1.5 text-sm">
              <Row label="Υποσύνολο" value={money(order.subtotalCents)} />
              {order.discountCents > 0 && (
                <Row
                  label={order.discountCode ? `Έκπτωση (${order.discountCode})` : "Έκπτωση"}
                  value={`−${money(order.discountCents)}`}
                />
              )}
              <Row label={`Μεταφορικά${order.shippingMethodName ? ` (${order.shippingMethodName})` : ""}`} value={money(order.shippingCents)} />
              <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
                <span className="font-semibold text-ink">Σύνολο</span>
                <span className="text-lg font-semibold tabular-nums text-ink">{money(order.totalCents)}</span>
              </div>
              <div className="text-xs text-ink-muted">
                Καθαρή αξία {money(netCents)} · ΦΠΑ {order.vatRate}% {money(order.vatCents)}
              </div>
            </div>
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <SectionTitle>Παράδοση</SectionTitle>
              <Address address={order.shippingAddress} />
            </Card>
            <Card>
              <SectionTitle>Χρέωση</SectionTitle>
              <Address address={order.billingAddress} />
              {order.taxDocumentType === "invoice" && (
                <div className="mt-3 border-t border-border pt-3 text-sm">
                  <div className="mb-1 text-xs font-semibold text-ink-muted uppercase">Τιμολόγιο</div>
                  {order.invoiceCompanyName && <div className="text-ink">{order.invoiceCompanyName}</div>}
                  {order.invoiceAfm && <div className="text-ink-muted">ΑΦΜ: {order.invoiceAfm}</div>}
                  {order.invoiceDoy && <div className="text-ink-muted">ΔΟΥ: {order.invoiceDoy}</div>}
                  {order.invoiceActivity && <div className="text-ink-muted">{order.invoiceActivity}</div>}
                </div>
              )}
            </Card>
          </div>

          <section>
            <SectionTitle>Ιστορικό</SectionTitle>
            <Card className="p-0">
              <ol className="divide-y divide-border">
                {order.events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm">
                    <span className="font-medium text-ink">{EVENT_LABELS[e.type] ?? e.type}</span>
                    {e.fromStatus && e.toStatus && (
                      <span className="text-ink-muted">
                        {e.fromStatus} → {e.toStatus}
                      </span>
                    )}
                    {e.note && <span className="text-ink-muted">{e.note}</span>}
                    <span className="ml-auto text-xs text-ink-muted">
                      {e.adminName ? `${e.adminName} · ` : ""}
                      {formatDateTime(e.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <SectionTitle>Πελάτης</SectionTitle>
            <div className="text-sm">
              <div className="text-ink">{order.email}</div>
              {order.phone && <div className="text-ink-muted">{order.phone}</div>}
              {order.customerId ? (
                <Link
                  href={`/admin/customers/${order.customerId}`}
                  className="mt-2 inline-block text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  Προβολή πελάτη →
                </Link>
              ) : (
                <p className="mt-2 text-xs text-ink-muted">Παραγγελία επισκέπτη (χωρίς λογαριασμό).</p>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle>Διαχείριση</SectionTitle>
            <OrderStatusControls
              orderId={order.id}
              status={order.status}
              paymentStatus={order.paymentStatus}
              fulfillmentStatus={order.fulfillmentStatus}
              adminNote={order.adminNote}
              itemCount={itemCount}
            />
          </Card>

          <Card>
            <SectionTitle>Αποστολή</SectionTitle>
            <ShipmentControls
              orderId={order.id}
              courierName={order.courierName}
              trackingCode={order.trackingCode}
              trackingUrl={order.trackingUrl}
              confirmationEmailSentAt={order.confirmationEmailSentAt}
              shipmentEmailSentAt={order.shipmentEmailSentAt}
            />
          </Card>

          {/* Owner-only, same tier as the other destructive/account-
              management controls in this admin — hiding it from a staff-role
              admin is UX only, deleteOrderPermanentlyAction re-checks this
              independently server-side regardless of what this page renders. */}
          {admin?.role === "owner" && (
            <Card>
              <SectionTitle>Οριστική διαγραφή</SectionTitle>
              <DeleteOrderControls orderId={order.id} orderNumber={order.orderNumber} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-ink-muted">{label}</span>
      <span className="tabular-nums text-ink">{value}</span>
    </div>
  );
}
