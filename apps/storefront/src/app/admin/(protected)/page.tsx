import Link from "next/link";
import {
  getBestSellers,
  getDashboardMetrics,
  getLowStockItems,
  getRecentOrders,
} from "@/lib/admin/dashboard";
import {
  Card,
  EmptyState,
  LinkedRow,
  PageHeader,
  SectionTitle,
  StatCard,
  StatusBadge,
  Table,
  Td,
  Th,
  formatDateTime,
  money,
} from "@/components/admin/ui/primitives";

export default async function AdminDashboard() {
  // Four independent queries in parallel — the metrics block is itself a
  // single statement, so this is four round trips for the whole page.
  const [metrics, recentOrders, bestSellers, lowStock] = await Promise.all([
    getDashboardMetrics(),
    getRecentOrders(8),
    getBestSellers(5),
    getLowStockItems(6),
  ]);

  return (
    <>
      <PageHeader
        title="Πίνακας ελέγχου"
        description="Επισκόπηση του καταστήματος σε πραγματικό χρόνο."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Πωλήσεις σήμερα" value={money(metrics.salesTodayCents)} hint={`${metrics.ordersToday} παραγγελίες`} />
        <StatCard label="Έσοδα (7 ημέρες)" value={money(metrics.revenueThisWeekCents)} hint={`${metrics.ordersThisWeek} παραγγελίες`} />
        <StatCard label="Έσοδα (μήνας)" value={money(metrics.revenueThisMonthCents)} hint={`${metrics.unitsSoldThisMonth} τεμάχια`} />
        <StatCard
          label="Μέση αξία παραγγελίας"
          value={money(metrics.averageOrderValueCents)}
          hint="Τελευταίες 30 ημέρες"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Εκκρεμείς παραγγελίες"
          value={String(metrics.pendingOrders)}
          hint={metrics.pendingOrders > 0 ? "Χρειάζονται επεξεργασία" : "Καμία εκκρεμότητα"}
          tone={metrics.pendingOrders > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Χαμηλό απόθεμα"
          value={String(metrics.lowStockCount)}
          hint="5 τεμάχια ή λιγότερα"
          tone={metrics.lowStockCount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Εξαντλημένα"
          value={String(metrics.outOfStockCount)}
          hint="Μη διαθέσιμα προς πώληση"
          tone={metrics.outOfStockCount > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Νέοι πελάτες"
          value={String(metrics.newCustomersThisWeek)}
          hint="Τελευταίες 7 ημέρες"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle hint={`${metrics.activeProducts} από ${metrics.totalProducts} προϊόντα ενεργά`}>
            Πρόσφατες παραγγελίες
          </SectionTitle>
          {recentOrders.length === 0 ? (
            <EmptyState
              title="Καμία παραγγελία ακόμα"
              description="Μόλις γίνει η πρώτη παραγγελία, θα εμφανιστεί εδώ με την κατάστασή της."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Αριθμός</Th>
                  <Th>Πελάτης</Th>
                  <Th>Ημερομηνία</Th>
                  <Th>Κατάσταση</Th>
                  <Th align="right">Σύνολο</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <LinkedRow key={o.id} href={`/admin/orders/${o.id}`}>
                    <Td className="font-medium tabular-nums">#{o.orderNumber}</Td>
                    <Td className="max-w-[14rem] truncate text-ink-muted">{o.email}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(o.createdAt)}</Td>
                    <Td>
                      <StatusBadge value={o.status} kind="order" />
                    </Td>
                    <Td align="right" className="font-medium tabular-nums">
                      {money(o.totalCents)}
                    </Td>
                  </LinkedRow>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section>
            <SectionTitle hint="90 ημέρες">Κορυφαία προϊόντα</SectionTitle>
            <Card className="p-0">
              {bestSellers.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-muted">
                  Δεν υπάρχουν ακόμα πωλήσεις για κατάταξη.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {bestSellers.map((p) => (
                    <li key={p.slug || p.title} className="flex items-baseline justify-between gap-3 px-5 py-3">
                      <span className="min-w-0 truncate text-sm text-ink">{p.title}</span>
                      <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                        {p.unitsSold} τεμ.
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle>Χαμηλό απόθεμα</SectionTitle>
            <Card className="p-0">
              {lowStock.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-muted">
                  Όλα τα προϊόντα έχουν επαρκές απόθεμα.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {lowStock.map((item) => (
                    <li key={item.sku} className="flex items-baseline justify-between gap-3 px-5 py-3">
                      <Link
                        href={`/admin/products?q=${encodeURIComponent(item.sku)}`}
                        className="min-w-0 truncate text-sm text-ink transition-colors hover:text-accent"
                      >
                        {item.title}
                      </Link>
                      <span
                        className={`shrink-0 text-sm font-medium tabular-nums ${
                          item.stock <= 0 ? "text-danger" : "text-accent"
                        }`}
                      >
                        {item.stock}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
