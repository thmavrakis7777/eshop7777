import Link from "next/link";
import { listOrders, type OrderStatus, type PaymentStatus } from "@/lib/admin/orders";
import {
  EmptyState, LinkedRow, PageHeader, StatusBadge, Table, Td, Th, formatDateTime, money,
} from "@/components/admin/ui/primitives";

export const metadata = { title: "Παραγγελίες" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const status = (one(sp.status) ?? "all") as OrderStatus | "all";
  const paymentStatus = (one(sp.payment) ?? "all") as PaymentStatus | "all";
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);

  const { orders, total, perPage } = await listOrders({ q, status, paymentStatus, page });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const hasFilters = Boolean(q || status !== "all" || paymentStatus !== "all");

  return (
    <>
      <PageHeader title="Παραγγελίες" description={`${total} ${total === 1 ? "παραγγελία" : "παραγγελίες"}`} />

      <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search" name="q" defaultValue={q}
          placeholder="Αριθμός παραγγελίας, email ή όνομα…"
          aria-label="Αναζήτηση παραγγελιών"
          className="min-w-[16rem] flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <select name="status" defaultValue={status} aria-label="Κατάσταση"
          className="rounded-md border border-border bg-bg px-2.5 py-2 text-sm">
          <option value="all">Κάθε κατάσταση</option>
          <option value="pending">Σε αναμονή</option>
          <option value="confirmed">Επιβεβαιωμένη</option>
          <option value="processing">Σε επεξεργασία</option>
          <option value="shipped">Απεστάλη</option>
          <option value="delivered">Παραδόθηκε</option>
          <option value="cancelled">Ακυρωμένη</option>
        </select>
        <select name="payment" defaultValue={paymentStatus} aria-label="Πληρωμή"
          className="rounded-md border border-border bg-bg px-2.5 py-2 text-sm">
          <option value="all">Κάθε πληρωμή</option>
          <option value="unpaid">Απλήρωτη</option>
          <option value="paid">Πληρωμένη</option>
          <option value="refunded">Επιστροφή</option>
        </select>
        <button type="submit" className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface">
          Εφαρμογή
        </button>
        {hasFilters && (
          <Link href="/admin/orders" className="px-2 text-sm text-ink-muted hover:text-ink">Καθαρισμός</Link>
        )}
      </form>

      {orders.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Καμία παραγγελία δεν ταιριάζει" : "Καμία παραγγελία ακόμα"}
          description={
            hasFilters
              ? "Δοκίμασε διαφορετικά φίλτρα."
              : "Μόλις γίνει η πρώτη παραγγελία στο κατάστημα, θα εμφανιστεί εδώ."
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Αριθμός</Th><Th>Πελάτης</Th><Th>Ημερομηνία</Th>
                <Th>Κατάσταση</Th><Th>Πληρωμή</Th><Th align="right">Σύνολο</Th><Th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <LinkedRow key={o.id} href={`/admin/orders/${o.id}`}>
                  <Td className="font-medium tabular-nums">#{o.orderNumber}</Td>
                  <Td>
                    <div className="text-ink">{o.customerName || "—"}</div>
                    <div className="text-xs text-ink-muted">{o.email}</div>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(o.createdAt)}</Td>
                  <Td><StatusBadge value={o.status} kind="order" /></Td>
                  <Td><StatusBadge value={o.paymentStatus} kind="payment" /></Td>
                  <Td align="right" className="font-medium tabular-nums">{money(o.totalCents)}</Td>
                </LinkedRow>
              ))}
            </tbody>
          </Table>
          {totalPages > 1 && (
            <nav className="mt-5 flex items-center justify-between text-sm" aria-label="Σελιδοποίηση">
              <span className="text-ink-muted">Σελίδα {page} από {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/admin/orders?page=${page - 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">
                    Προηγούμενη
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/admin/orders?page=${page + 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">
                    Επόμενη
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}
